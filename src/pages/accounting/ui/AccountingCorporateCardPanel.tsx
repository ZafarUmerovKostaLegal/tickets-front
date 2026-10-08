import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PAYMENT_META, STATUS_META } from '@entities/expenses/model/constants';
import { fetchExpenseById, fetchExpenses } from '@entities/expenses/model/expensesApi';
import type { ExpenseRequest, ExpenseStatus, PaymentMethod } from '@entities/expenses/model/types';
import { useCurrentUser } from '@shared/hooks';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import './AccountingCorporateCardPanel.css';

const ExpensesFormPanel = lazy(() => import('@pages/expenses/ui/ExpensesFormPanel').then((m) => ({ default: m.ExpensesFormPanel })));

type CardRule = {
    id: string;
    owner: string;
    kind: string;
    note: string;
    /** Кириллица и латиница: в заявке партнёр часто записан как Vazgen Grigoryan. */
    aliases: string[];
};

/** Карты и подписи видов расхода — как в согласованной таблице. */
const CARD_RULES: CardRule[] = [
    { id: 'akhmadjonov', owner: 'Ахмаджонов А', kind: 'расход партнера', note: '', aliases: ['ахмадж', 'akhmad', 'ahmadjon', 'aakhmad'] },
    { id: 'khasanov', owner: 'Хасанов Н', kind: 'общий', note: '', aliases: ['хасанов', 'khasanov', 'hasanov', 'xasanov'] },
    { id: 'grigoryan', owner: 'Григорян В', kind: 'офисный расход', note: '', aliases: ['григор', 'grigor', 'grigoryan'] },
    { id: 'dogonkin', owner: 'Догонкин М', kind: '', note: '', aliases: ['догонк', 'dogonkin', 'dogonk'] },
    { id: 'yunusov', owner: 'Юнусов Ш', kind: '', note: '', aliases: ['юнусов', 'yunusov', 'iunusov', 'yunus'] },
    { id: 'general', owner: 'Общий', kind: 'общий', note: '', aliases: [] },
    { id: 'office', owner: 'Карта офиса', kind: '', note: 'обязательное по карте офиса', aliases: [] },
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
    const hay = [
        personName(row),
        row.partnerUser?.displayName,
        row.partnerUser?.email,
        row.createdBy?.displayName,
        row.createdBy?.email,
    ].filter(Boolean).join(' ').toLowerCase();
    return CARD_RULES.find((rule) => rule.aliases.some((alias) => hay.includes(alias))) ?? null;
}

function isOfficeCard(row: ExpenseRequest): boolean {
    return (row.paymentMethod ?? '').toLowerCase() === 'card';
}

function cardOwner(row: ExpenseRequest): string {
    if (isGeneralExpense(row))
        return 'Общий';
    const rule = matchRule(row);
    if (rule)
        return rule.owner;
    if (row.expenseType === 'partner_expense')
        return personName(row) || 'Расход партнера';
    if (isOfficeCard(row))
        return 'Карта офиса';
    return personName(row) || '—';
}

function isGeneralExpense(row: ExpenseRequest): boolean {
    if (row.expenseType === 'company_expense')
        return true;
    return (row.expenseSubtype ?? '').trim() === 'partner_general';
}

function expenseKind(row: ExpenseRequest): string {
    if (isGeneralExpense(row))
        return 'общий';
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
    if (rule.id === 'general')
        return isGeneralExpense(row);
    if (rule.id === 'office')
        return isOfficeCard(row) && row.expenseType !== 'partner_expense' && !isGeneralExpense(row) && !matchRule(row);
    if (row.expenseType === 'partner_expense' && matchRule(row)?.id === rule.id)
        return true;
    return matchRule(row)?.id === rule.id;
}

function FilterPick({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    return (
        <div className="acct-card__field">
            <span id={`acct-card-${label}`}>{label}</span>
            <SearchableSelect
                portalDropdown
                value={value}
                items={options}
                getOptionValue={(item) => item.value}
                getOptionLabel={(item) => item.label}
                getSearchText={(item) => item.label}
                onSelect={(item) => onChange(item.value)}
                aria-labelledby={`acct-card-${label}`}
            />
        </div>
    );
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
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState('');
    const [status, setStatus] = useState('');
    const [payment, setPayment] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
    const [open, setOpen] = useState<ExpenseRequest | null>(null);
    const [panelMounted, setPanelMounted] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void Promise.all([
            fetchExpenses({ paymentMethod: 'card', limit: 200, sortBy: 'expenseDate', sortOrder: 'desc' }),
            fetchExpenses({ expenseType: 'partner_expense', limit: 200, sortBy: 'expenseDate', sortOrder: 'desc' }),
            fetchExpenses({ expenseType: 'company_expense', limit: 200, sortBy: 'expenseDate', sortOrder: 'desc' }),
        ])
            .then(([cardRes, partnerRes, companyRes]) => {
                if (cancelled)
                    return;
                const byId = new Map<string, ExpenseRequest>();
                for (const row of [...(cardRes.items ?? []), ...(partnerRes.items ?? []), ...(companyRes.items ?? [])])
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

    const kindOptions = useMemo(() => {
        const values = new Set<string>();
        for (const rule of CARD_RULES) {
            if (rule.kind)
                values.add(rule.kind);
        }
        values.add('расход партнера');
        return [...values];
    }, []);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = (rows ?? []).filter((row) => {
            if (!belongsToCard(row, cardId))
                return false;
            const rowKind = expenseKind(row);
            if (kind === '__none' ? rowKind !== '' : kind && rowKind !== kind)
                return false;
            if (status && row.status !== status)
                return false;
            if (payment && (row.paymentMethod ?? '') !== payment)
                return false;
            const day = (row.expenseDate ?? '').slice(0, 10);
            if (dateFrom && day < dateFrom)
                return false;
            if (dateTo && day > dateTo)
                return false;
            if (!q)
                return true;
            const blob = [cardOwner(row), expenseKind(row), expenseDescription(row), personName(row), row.vendor, row.comment]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return blob.includes(q);
        });
        list.sort((a, b) => {
            if (sort === 'amount_desc' || sort === 'amount_asc') {
                const diff = (Number(a.amountUzs) || 0) - (Number(b.amountUzs) || 0);
                return sort === 'amount_asc' ? diff : -diff;
            }
            const diff = (a.expenseDate ?? '').localeCompare(b.expenseDate ?? '');
            return sort === 'date_asc' ? diff : -diff;
        });
        return list;
    }, [rows, cardId, query, kind, status, payment, dateFrom, dateTo, sort]);

    const filtersOn = Boolean(query || kind || status || payment || dateFrom || dateTo || cardId !== ALL_CARDS || sort !== 'date_desc');
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

            <div className="acct-card__filters">
                <label className="acct-card__field acct-card__field--search">
                    <span>Поиск</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Описание, владелец, комментарий" />
                </label>
                <FilterPick
                    label="Карта (владелец)"
                    value={cardId}
                    onChange={setCardId}
                    options={[
                        { value: ALL_CARDS, label: 'Все карты' },
                        ...CARD_RULES.map((rule) => ({ value: rule.id, label: rule.owner })),
                    ]}
                />
                <FilterPick
                    label="Вид расхода"
                    value={kind}
                    onChange={setKind}
                    options={[
                        { value: '', label: 'Все виды' },
                        ...kindOptions.map((value) => ({ value, label: value })),
                        { value: '__none', label: 'Без вида' },
                    ]}
                />
                <FilterPick
                    label="Статус"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: '', label: 'Все статусы' },
                        ...(Object.keys(STATUS_META) as ExpenseStatus[]).map((value) => ({
                            value,
                            label: STATUS_META[value].label,
                        })),
                    ]}
                />
                <FilterPick
                    label="Способ оплаты"
                    value={payment}
                    onChange={setPayment}
                    options={[
                        { value: '', label: 'Все способы' },
                        ...(Object.keys(PAYMENT_META) as PaymentMethod[]).map((value) => ({
                            value,
                            label: PAYMENT_META[value].label,
                        })),
                    ]}
                />
                <label className="acct-card__field">
                    <span>Дата от</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="acct-card__field">
                    <span>Дата до</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <FilterPick
                    label="Сортировка"
                    value={sort}
                    onChange={(value) => setSort(value as typeof sort)}
                    options={[
                        { value: 'date_desc', label: 'Сначала новые' },
                        { value: 'date_asc', label: 'Сначала старые' },
                        { value: 'amount_desc', label: 'Сумма по убыванию' },
                        { value: 'amount_asc', label: 'Сумма по возрастанию' },
                    ]}
                />
                <button
                    type="button"
                    className="acct-card__reset"
                    disabled={!filtersOn}
                    onClick={() => {
                        setQuery('');
                        setCardId(ALL_CARDS);
                        setKind('');
                        setStatus('');
                        setPayment('');
                        setDateFrom('');
                        setDateTo('');
                        setSort('date_desc');
                    }}
                >
                    Сбросить
                </button>
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
                                <th>Карта (владелец)</th>
                                <th>Вид расхода</th>
                                <th>Описание</th>
                                <th>Статус</th>
                                <th>Способ оплаты</th>
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
                                    <td>{STATUS_META[row.status]?.label ?? row.status}</td>
                                    <td>{PAYMENT_META[(row.paymentMethod ?? '') as PaymentMethod]?.label ?? (row.paymentMethod || '—')}</td>
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
