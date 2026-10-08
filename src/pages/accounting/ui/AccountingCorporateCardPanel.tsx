import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PAYMENT_META, STATUS_META } from '@entities/expenses/model/constants';
import { fetchExpenseById, fetchExpenses } from '@entities/expenses/model/expensesApi';
import type { ExpenseRequest, ExpenseStatus, PaymentMethod } from '@entities/expenses/model/types';
import { useCurrentUser } from '@shared/hooks';
import { DatePicker } from '@shared/ui/DatePicker';
import '../../expenses/ui/ExpensesPage.css';
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

function ChipFilter({ label, active, open, onToggle, children, wide = false }: {
    label: string;
    active: boolean;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <div className={`exp-filter${active ? ' exp-filter--active' : ''}${wide ? ' exp-filter--wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="exp-filter__btn" onClick={onToggle}>
                <span className="exp-filter__btn-text">{label}</span>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <polyline points={open ? '4 10 8 6 12 10' : '4 6 8 10 12 6'} />
                </svg>
            </button>
            {open ? (
                <div className="exp-filter__drop">
                    {children}
                </div>
            ) : null}
        </div>
    );
}

function ChipOptions({ value, options, onChange }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    const [q, setQ] = useState('');
    const query = q.trim().toLowerCase();
    const shown = query
        ? options.filter((item) => item.label.toLowerCase().includes(query))
        : options;
    return (
        <>
            <div className="exp-filter__author-search" onClick={(e) => e.stopPropagation()}>
                <input
                    type="search"
                    className="exp-filter__author-search-input"
                    placeholder="Поиск…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Поиск в списке"
                />
            </div>
            {shown.length === 0 ? <p className="exp-filter__opt">Ничего не найдено</p> : null}
            {shown.map((item) => (
                <button
                    key={item.value || 'all'}
                    type="button"
                    className={`exp-filter__opt${value === item.value ? ' exp-filter__opt--on' : ''}`}
                    onClick={() => onChange(item.value)}
                >
                    {item.label}
                </button>
            ))}
        </>
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
    const [openChip, setOpenChip] = useState<string | null>(null);
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

    const cardLabel = cardId === ALL_CARDS
        ? 'Карта (владелец)'
        : (CARD_RULES.find((rule) => rule.id === cardId)?.owner ?? 'Карта (владелец)');
    const kindLabel = kind === '__none' ? 'Без вида' : (kind || 'Вид расхода');
    const statusLabel = status ? (STATUS_META[status as ExpenseStatus]?.label ?? 'Статус') : 'Статус';
    const paymentLabel = payment ? (PAYMENT_META[payment as PaymentMethod]?.label ?? 'Способ оплаты') : 'Способ оплаты';
    const sortLabel = sort === 'date_asc'
        ? 'Сначала старые'
        : sort === 'amount_desc'
            ? 'Сумма по убыванию'
            : sort === 'amount_asc'
                ? 'Сумма по возрастанию'
                : 'Сначала новые';
    const toggleChip = (id: string) => setOpenChip((prev) => (prev === id ? null : id));

    return (
        <section className="acct-card acct-card-list" aria-label="Корпоративная карта">
            <div className="tt-settings__actions-row tt-settings__actions-row--clients exp-tt-toolbar">
                <div className="tt-settings__toolbar-left">
                    {rows ? <p className="acct-card__total acct-card__total--inline"><span>Итого, UZS</span> <strong>{money(totalUzs)}</strong></p> : null}
                </div>
                <div className="tt-settings__actions-end">
                    <div className="tt-settings__search-wrap">
                        <span className="tt-settings__search-icon" aria-hidden>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input type="search" className="tt-settings__search" placeholder="По описанию, владельцу или комментарию" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск по операциям" />
                    </div>
                </div>
            </div>
            <div className="exp-tt-filters-outer">
                <div className="exp-filters" aria-label="Фильтры">
                    <ChipFilter label={cardLabel} active={cardId !== ALL_CARDS} open={openChip === 'card'} onToggle={() => toggleChip('card')} wide>
                        <ChipOptions
                            value={cardId}
                            onChange={(value) => { setCardId(value); setOpenChip(null); }}
                            options={[{ value: ALL_CARDS, label: 'Все карты' }, ...CARD_RULES.map((rule) => ({ value: rule.id, label: rule.owner }))]}
                        />
                    </ChipFilter>
                    <ChipFilter label={kindLabel} active={Boolean(kind)} open={openChip === 'kind'} onToggle={() => toggleChip('kind')}>
                        <ChipOptions
                            value={kind}
                            onChange={(value) => { setKind(value); setOpenChip(null); }}
                            options={[{ value: '', label: 'Все виды' }, ...kindOptions.map((value) => ({ value, label: value })), { value: '__none', label: 'Без вида' }]}
                        />
                    </ChipFilter>
                    <ChipFilter label={statusLabel} active={Boolean(status)} open={openChip === 'status'} onToggle={() => toggleChip('status')}>
                        <ChipOptions
                            value={status}
                            onChange={(value) => { setStatus(value); setOpenChip(null); }}
                            options={[{ value: '', label: 'Все статусы' }, ...(Object.keys(STATUS_META) as ExpenseStatus[]).map((value) => ({ value, label: STATUS_META[value].label }))]}
                        />
                    </ChipFilter>
                    <ChipFilter label={paymentLabel} active={Boolean(payment)} open={openChip === 'pay'} onToggle={() => toggleChip('pay')} wide>
                        <ChipOptions
                            value={payment}
                            onChange={(value) => { setPayment(value); setOpenChip(null); }}
                            options={[{ value: '', label: 'Все способы' }, ...(Object.keys(PAYMENT_META) as PaymentMethod[]).map((value) => ({ value, label: PAYMENT_META[value].label }))]}
                        />
                    </ChipFilter>
                    <ChipFilter label={sortLabel} active={sort !== 'date_desc'} open={openChip === 'sort'} onToggle={() => toggleChip('sort')}>
                        <ChipOptions
                            value={sort}
                            onChange={(value) => { setSort(value as typeof sort); setOpenChip(null); }}
                            options={[
                                { value: 'date_desc', label: 'Сначала новые' },
                                { value: 'date_asc', label: 'Сначала старые' },
                                { value: 'amount_desc', label: 'Сумма по убыванию' },
                                { value: 'amount_asc', label: 'Сумма по возрастанию' },
                            ]}
                        />
                    </ChipFilter>
                    {filtersOn ? (
                        <button type="button" className="exp-filters-reset" onClick={() => {
                            setQuery('');
                            setCardId(ALL_CARDS);
                            setKind('');
                            setStatus('');
                            setPayment('');
                            setDateFrom('');
                            setDateTo('');
                            setSort('date_desc');
                            setOpenChip(null);
                        }}>
                            Сбросить
                        </button>
                    ) : null}
                </div>
                <div className="exp-filters-custom-range" aria-label="Период">
                    <span className="exp-filters-custom-range__label">Период:</span>
                    <div className="exp-filters-custom-range__field">
                        <span className="exp-filters-custom-range__field-label">С</span>
                        <DatePicker value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} portal buttonClassName="exp-filters-custom-range__picker" emptyLabel="дд.мм.гггг" />
                    </div>
                    <div className="exp-filters-custom-range__field">
                        <span className="exp-filters-custom-range__field-label">По</span>
                        <DatePicker value={dateTo} min={dateFrom || undefined} onChange={setDateTo} portal buttonClassName="exp-filters-custom-range__picker" emptyLabel="дд.мм.гггг" />
                    </div>
                </div>
            </div>

            {error ? <p className="acct-card__error">{error}</p> : null}
            {rows == null && !error ? <p className="acct-card__empty">Загрузка…</p> : null}
            {rows && visible.length === 0 ? <p className="acct-card__empty">По этой карте операций пока нет</p> : null}
            {rows && visible.length > 0 ? (
                <div className="exp-table acct-card-table" role="region" aria-label="Операции по корпоративной карте">
                    <div className="exp-table__body">
                        <div className="exp-table__row exp-table__row--head" role="row">
                            <div className="exp-table__th" role="columnheader">Дата</div>
                            <div className="exp-table__th" role="columnheader">Карта (владелец)</div>
                            <div className="exp-table__th" role="columnheader">Вид расхода</div>
                            <div className="exp-table__th" role="columnheader">Описание</div>
                            <div className="exp-table__th" role="columnheader">Статус</div>
                            <div className="exp-table__th" role="columnheader">Способ оплаты</div>
                            <div className="exp-table__th" role="columnheader">Сумма, UZS</div>
                        </div>
                        {visible.map((row) => (
                            <button key={row.id} type="button" className="exp-table__row acct-card-table__row" onClick={() => openExpense(row)}>
                                <span>{formatDate(row.expenseDate)}</span>
                                <span>{cardOwner(row)}</span>
                                <span>{expenseKind(row) || '—'}</span>
                                <span className="acct-card-table__desc">{expenseDescription(row)}</span>
                                <span className={`exp-status exp-status--${row.status}`}>{STATUS_META[row.status]?.label ?? row.status}</span>
                                <span>{PAYMENT_META[(row.paymentMethod ?? '') as PaymentMethod]?.label ?? (row.paymentMethod || '—')}</span>
                                <span className="acct-card__num">{money(Number(row.amountUzs) || 0)}</span>
                            </button>
                        ))}
                    </div>
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
