import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { fetchExpenseById, fetchExpenses } from '@entities/expenses/model/expensesApi';
import type { ExpenseRequest } from '@entities/expenses/model/types';
import { useCurrentUser } from '@shared/hooks';
import './AccountingCorporateCardPanel.css';

const ExpensesFormPanel = lazy(() => import('@pages/expenses/ui/ExpensesFormPanel').then((m) => ({ default: m.ExpensesFormPanel })));

type CardRule = {
    id: string;
    owner: string;
    kind: string;
    note: string;
    match: string | null;
};

/** Карты и подписи видов расхода — как в согласованной таблице. */
const CARD_RULES: CardRule[] = [
    { id: 'akhmadjonov', owner: 'Ахмаджонов А', kind: 'расход партнера', note: '', match: 'ахмадж' },
    { id: 'khasanov', owner: 'Хасанов Н', kind: 'общий', note: '', match: 'хасанов' },
    { id: 'grigoryan', owner: 'Григорян В', kind: 'офисный расход', note: '', match: 'григор' },
    { id: 'dogonkin', owner: 'Догонкин М', kind: '', note: '', match: 'догонк' },
    { id: 'yunusov', owner: 'Юнусов Ш', kind: '', note: '', match: 'юнусов' },
    { id: 'office', owner: 'Карта офиса', kind: '', note: 'обязательное по карте офиса', match: null },
];

const ALL_CARDS = 'all';

function personName(row: ExpenseRequest): string {
    return (
        row.partnerUser?.displayName
        || row.createdBy?.displayName
        || row.partnerUser?.email
        || row.createdBy?.email
        || ''
    ).trim();
}

function matchRule(row: ExpenseRequest): CardRule | null {
    const hay = `${personName(row)} ${row.createdBy?.email ?? ''} ${row.partnerUser?.email ?? ''}`.toLowerCase();
    return CARD_RULES.find((rule) => rule.match && hay.includes(rule.match)) ?? null;
}

function isOfficeCard(row: ExpenseRequest): boolean {
    return (row.paymentMethod ?? '').toLowerCase() === 'card';
}

function cardOwner(row: ExpenseRequest): string {
    const rule = matchRule(row);
    if (rule)
        return rule.owner;
    if (row.expenseType === 'partner_expense')
        return personName(row) || 'Расход партнера';
    if (isOfficeCard(row))
        return 'Карта офиса';
    return personName(row) || '—';
}

function expenseKind(row: ExpenseRequest): string {
    if (row.expenseType === 'partner_expense')
        return 'расход партнера';
    return matchRule(row)?.kind ?? '';
}

function expenseDescription(row: ExpenseRequest): string {
    const text = row.description?.trim() || row.businessPurpose?.trim() || '';
    if (text)
        return text;
    if (isOfficeCard(row) && row.expenseType !== 'partner_expense')
        return 'обязательное по карте офиса';
    return '—';
}

function belongsToCard(row: ExpenseRequest, cardId: string): boolean {
    if (cardId === ALL_CARDS)
        return true;
    const rule = CARD_RULES.find((item) => item.id === cardId);
    if (!rule)
        return false;
    if (rule.id === 'office')
        return isOfficeCard(row) && !matchRule(row);
    return matchRule(row)?.id === rule.id;
}

function money(n: number): string {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function AccountingCorporateCardPanel() {
    const { user } = useCurrentUser();
    const [rows, setRows] = useState<ExpenseRequest[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cardId, setCardId] = useState(ALL_CARDS);
    const [open, setOpen] = useState<ExpenseRequest | null>(null);
    const [panelMounted, setPanelMounted] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void Promise.all([
            fetchExpenses({ paymentMethod: 'card', limit: 200, sortBy: 'expenseDate', sortOrder: 'desc' }),
            fetchExpenses({ expenseType: 'partner_expense', limit: 200, sortBy: 'expenseDate', sortOrder: 'desc' }),
        ])
            .then(([cardRes, partnerRes]) => {
                if (cancelled)
                    return;
                const byId = new Map<string, ExpenseRequest>();
                for (const row of [...(cardRes.items ?? []), ...(partnerRes.items ?? [])])
                    byId.set(row.id, row);
                setRows([...byId.values()]);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить операции по карте');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const visible = useMemo(
        () => (rows ?? []).filter((row) => belongsToCard(row, cardId)),
        [rows, cardId],
    );
    const totalUzs = visible.reduce((sum, row) => sum + (Number(row.amountUzs) || 0), 0);

    const openExpense = (row: ExpenseRequest) => {
        setOpen(row);
        setPanelMounted(true);
        void fetchExpenseById(row.id)
            .then((full) => setOpen((prev) => (prev?.id === full.id ? full : prev)))
            .catch(() => { });
    };

    return (
        <section className="acct-card" aria-label="Корпоративная карта">
            <header className="acct-card__head">
                <div>
                    <h2 className="acct-card__title">Корпоративная карта</h2>
                    <p className="acct-card__sub">Карты, вид расхода и операции. Расходы партнёров подписаны «расход партнера» и входят в общий список.</p>
                </div>
                {rows ? (
                    <p className="acct-card__total">
                        <span>Итого, UZS</span>
                        <strong>{money(totalUzs)}</strong>
                    </p>
                ) : null}
            </header>

            <div className="acct-card__table-wrap">
                <table className="acct-card__table acct-card__table--rules">
                    <thead>
                        <tr>
                            <th>карта (владелец)</th>
                            <th>вид расхода</th>
                            <th>описание</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            className={cardId === ALL_CARDS ? 'is-active' : undefined}
                            onClick={() => setCardId(ALL_CARDS)}
                        >
                            <td>Все карты</td>
                            <td />
                            <td>общий список, включая расходы партнеров</td>
                        </tr>
                        {CARD_RULES.map((rule) => (
                            <tr
                                key={rule.id}
                                className={cardId === rule.id ? 'is-active' : undefined}
                                onClick={() => setCardId(rule.id)}
                            >
                                <td>{rule.owner}</td>
                                <td>{rule.kind}</td>
                                <td>{rule.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {error ? <p className="acct-card__error">{error}</p> : null}
            {rows == null && !error ? <p className="acct-card__empty">Загрузка…</p> : null}
            {rows && visible.length === 0 ? <p className="acct-card__empty">По этой карте операций пока нет</p> : null}
            {rows && visible.length > 0 ? (
                <div className="acct-card__table-wrap">
                    <table className="acct-card__table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>карта (владелец)</th>
                                <th>вид расхода</th>
                                <th>описание</th>
                                <th>Сумма, UZS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((row) => (
                                <tr key={row.id} className="acct-card__expense" onClick={() => openExpense(row)}>
                                    <td>{formatDate(row.expenseDate)}</td>
                                    <td>{cardOwner(row)}</td>
                                    <td>{expenseKind(row)}</td>
                                    <td>{expenseDescription(row)}</td>
                                    <td className="acct-card__num">{money(Number(row.amountUzs) || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}

            {panelMounted ? (
                <Suspense fallback={null}>
                    <ExpensesFormPanel
                        isOpen={open != null}
                        mode="view"
                        editingRequest={open}
                        formScope={open?.expenseType === 'partner_expense' ? 'partner' : 'company'}
                        onClose={() => setOpen(null)}
                        onExited={() => {
                            if (open == null)
                                setPanelMounted(false);
                        }}
                        onSaveDraft={() => { }}
                        onSubmit={() => { }}
                        currentUserId={user?.id ?? null}
                        currentUserRole={user?.role ?? null}
                        currentUserEmail={user?.email ?? null}
                        currentUserDisplayName={user?.display_name ?? null}
                    />
                </Suspense>
            ) : null}
        </section>
    );
}
