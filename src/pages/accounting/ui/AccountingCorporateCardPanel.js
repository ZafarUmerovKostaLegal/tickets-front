import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PAYMENT_META, STATUS_META } from '@entities/expenses/model/constants';
import { fetchExpenseById, fetchExpenses } from '@entities/expenses/model/expensesApi';
import { useCurrentUser } from '@shared/hooks';
import { DatePicker } from '@shared/ui/DatePicker';
import '../../expenses/ui/ExpensesPage.css';
import './AccountingCorporateCardPanel.css';
const ExpensesFormPanel = lazy(() => import('@pages/expenses/ui/ExpensesFormPanel').then((m) => ({ default: m.ExpensesFormPanel })));
/** Карты и подписи видов расхода — как в согласованной таблице. */
const CARD_RULES = [
    { id: 'akhmadjonov', owner: 'Ахмаджонов А', kind: 'расход партнера', note: '', aliases: ['ахмадж', 'akhmad', 'ahmadjon', 'aakhmad'] },
    { id: 'khasanov', owner: 'Хасанов Н', kind: 'общий', note: '', aliases: ['хасанов', 'khasanov', 'hasanov', 'xasanov'] },
    { id: 'grigoryan', owner: 'Григорян В', kind: 'офисный расход', note: '', aliases: ['григор', 'grigor', 'grigoryan'] },
    { id: 'dogonkin', owner: 'Догонкин М', kind: '', note: '', aliases: ['догонк', 'dogonkin', 'dogonk'] },
    { id: 'yunusov', owner: 'Юнусов Ш', kind: '', note: '', aliases: ['юнусов', 'yunusov', 'iunusov', 'yunus'] },
    { id: 'general', owner: 'Общий', kind: 'общий', note: '', aliases: [] },
    { id: 'office', owner: 'Карта офиса', kind: '', note: 'обязательное по карте офиса', aliases: [] },
];
const ALL_CARDS = 'all';
function personName(row) {
    return (row.partnerUser?.displayName
        || row.createdBy?.displayName
        || row.partnerUser?.email
        || row.createdBy?.email
        || '').trim();
}
function matchRule(row) {
    const hay = [
        personName(row),
        row.partnerUser?.displayName,
        row.partnerUser?.email,
        row.createdBy?.displayName,
        row.createdBy?.email,
    ].filter(Boolean).join(' ').toLowerCase();
    return CARD_RULES.find((rule) => rule.aliases.some((alias) => hay.includes(alias))) ?? null;
}
function isOfficeCard(row) {
    return (row.paymentMethod ?? '').toLowerCase() === 'card';
}
function cardOwner(row) {
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
function isGeneralExpense(row) {
    if (row.expenseType === 'company_expense')
        return true;
    return (row.expenseSubtype ?? '').trim() === 'partner_general';
}
function expenseKind(row) {
    if (isGeneralExpense(row))
        return 'общий';
    if (row.expenseType === 'partner_expense')
        return 'расход партнера';
    return matchRule(row)?.kind ?? '';
}
function expenseDescription(row) {
    const text = row.description?.trim() || row.businessPurpose?.trim() || '';
    if (text)
        return text;
    if (isOfficeCard(row) && row.expenseType !== 'partner_expense')
        return 'обязательное по карте офиса';
    return '—';
}
function belongsToCard(row, cardId) {
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
function ChipFilter({ label, active, open, onToggle, children, wide = false }) {
    return (_jsxs("div", { className: `exp-filter${active ? ' exp-filter--active' : ''}${wide ? ' exp-filter--wide' : ''}`, onMouseDown: (event) => event.stopPropagation(), children: [_jsxs("button", { type: "button", className: "exp-filter__btn", onClick: onToggle, children: [_jsx("span", { className: "exp-filter__btn-text", children: label }), _jsx("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: _jsx("polyline", { points: open ? '4 10 8 6 12 10' : '4 6 8 10 12 6' }) })] }), open ? (_jsx("div", { className: "exp-filter__drop", children: children })) : null] }));
}
function ChipOptions({ value, options, onChange }) {
    const [q, setQ] = useState('');
    const query = q.trim().toLowerCase();
    const shown = query
        ? options.filter((item) => item.label.toLowerCase().includes(query))
        : options;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "exp-filter__author-search", onClick: (e) => e.stopPropagation(), children: _jsx("input", { type: "search", className: "exp-filter__author-search-input", placeholder: "\u041F\u043E\u0438\u0441\u043A\u2026", value: q, onChange: (e) => setQ(e.target.value), "aria-label": "\u041F\u043E\u0438\u0441\u043A \u0432 \u0441\u043F\u0438\u0441\u043A\u0435" }) }), shown.length === 0 ? _jsx("p", { className: "exp-filter__opt", children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }) : null, shown.map((item) => (_jsx("button", { type: "button", className: `exp-filter__opt${value === item.value ? ' exp-filter__opt--on' : ''}`, onClick: () => onChange(item.value), children: item.label }, item.value || 'all')))] }));
}
function money(n) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(iso) {
    if (!iso)
        return '—';
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function AccountingCorporateCardPanel() {
    const { user } = useCurrentUser();
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);
    const [cardId, setCardId] = useState(ALL_CARDS);
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState('');
    const [status, setStatus] = useState('');
    const [payment, setPayment] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sort, setSort] = useState('date_desc');
    const [openChip, setOpenChip] = useState(null);
    const [open, setOpen] = useState(null);
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
            const byId = new Map();
            for (const row of [...(cardRes.items ?? []), ...(partnerRes.items ?? []), ...(companyRes.items ?? [])])
                byId.set(row.id, row);
            setRows([...byId.values()]);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Не удалось загрузить операции по карте');
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const kindOptions = useMemo(() => {
        const values = new Set();
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
    const openExpense = (row) => {
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
    const statusLabel = status ? (STATUS_META[status]?.label ?? 'Статус') : 'Статус';
    const paymentLabel = payment ? (PAYMENT_META[payment]?.label ?? 'Способ оплаты') : 'Способ оплаты';
    const sortLabel = sort === 'date_asc'
        ? 'Сначала старые'
        : sort === 'amount_desc'
            ? 'Сумма по убыванию'
            : sort === 'amount_asc'
                ? 'Сумма по возрастанию'
                : 'Сначала новые';
    const toggleChip = (id) => setOpenChip((prev) => (prev === id ? null : id));
    return (_jsxs("section", { className: "acct-card acct-card-list", "aria-label": "\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430", children: [_jsxs("div", { className: "tt-settings__actions-row tt-settings__actions-row--clients exp-tt-toolbar", children: [_jsx("div", { className: "tt-settings__toolbar-left", children: rows ? _jsxs("p", { className: "acct-card__total acct-card__total--inline", children: [_jsx("span", { children: "\u0418\u0442\u043E\u0433\u043E, UZS" }), " ", _jsx("strong", { children: money(totalUzs) })] }) : null }), _jsx("div", { className: "tt-settings__actions-end", children: _jsxs("div", { className: "tt-settings__search-wrap", children: [_jsx("span", { className: "tt-settings__search-icon", "aria-hidden": true, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })] }) }), _jsx("input", { type: "search", className: "tt-settings__search", placeholder: "\u041F\u043E \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044E, \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0443 \u0438\u043B\u0438 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044E", value: query, onChange: (e) => setQuery(e.target.value), "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F\u043C" })] }) })] }), _jsxs("div", { className: "exp-tt-filters-outer", children: [_jsxs("div", { className: "exp-filters", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440\u044B", children: [_jsx(ChipFilter, { label: cardLabel, active: cardId !== ALL_CARDS, open: openChip === 'card', onToggle: () => toggleChip('card'), wide: true, children: _jsx(ChipOptions, { value: cardId, onChange: (value) => { setCardId(value); setOpenChip(null); }, options: [{ value: ALL_CARDS, label: 'Все карты' }, ...CARD_RULES.map((rule) => ({ value: rule.id, label: rule.owner }))] }) }), _jsx(ChipFilter, { label: kindLabel, active: Boolean(kind), open: openChip === 'kind', onToggle: () => toggleChip('kind'), children: _jsx(ChipOptions, { value: kind, onChange: (value) => { setKind(value); setOpenChip(null); }, options: [{ value: '', label: 'Все виды' }, ...kindOptions.map((value) => ({ value, label: value })), { value: '__none', label: 'Без вида' }] }) }), _jsx(ChipFilter, { label: statusLabel, active: Boolean(status), open: openChip === 'status', onToggle: () => toggleChip('status'), children: _jsx(ChipOptions, { value: status, onChange: (value) => { setStatus(value); setOpenChip(null); }, options: [{ value: '', label: 'Все статусы' }, ...Object.keys(STATUS_META).map((value) => ({ value, label: STATUS_META[value].label }))] }) }), _jsx(ChipFilter, { label: paymentLabel, active: Boolean(payment), open: openChip === 'pay', onToggle: () => toggleChip('pay'), wide: true, children: _jsx(ChipOptions, { value: payment, onChange: (value) => { setPayment(value); setOpenChip(null); }, options: [{ value: '', label: 'Все способы' }, ...Object.keys(PAYMENT_META).map((value) => ({ value, label: PAYMENT_META[value].label }))] }) }), _jsx(ChipFilter, { label: sortLabel, active: sort !== 'date_desc', open: openChip === 'sort', onToggle: () => toggleChip('sort'), children: _jsx(ChipOptions, { value: sort, onChange: (value) => { setSort(value); setOpenChip(null); }, options: [
                                        { value: 'date_desc', label: 'Сначала новые' },
                                        { value: 'date_asc', label: 'Сначала старые' },
                                        { value: 'amount_desc', label: 'Сумма по убыванию' },
                                        { value: 'amount_asc', label: 'Сумма по возрастанию' },
                                    ] }) }), filtersOn ? (_jsx("button", { type: "button", className: "exp-filters-reset", onClick: () => {
                                    setQuery('');
                                    setCardId(ALL_CARDS);
                                    setKind('');
                                    setStatus('');
                                    setPayment('');
                                    setDateFrom('');
                                    setDateTo('');
                                    setSort('date_desc');
                                    setOpenChip(null);
                                }, children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" })) : null] }), _jsxs("div", { className: "exp-filters-custom-range", "aria-label": "\u041F\u0435\u0440\u0438\u043E\u0434", children: [_jsx("span", { className: "exp-filters-custom-range__label", children: "\u041F\u0435\u0440\u0438\u043E\u0434:" }), _jsxs("div", { className: "exp-filters-custom-range__field", children: [_jsx("span", { className: "exp-filters-custom-range__field-label", children: "\u0421" }), _jsx(DatePicker, { value: dateFrom, max: dateTo || undefined, onChange: setDateFrom, portal: true, buttonClassName: "exp-filters-custom-range__picker", emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433" })] }), _jsxs("div", { className: "exp-filters-custom-range__field", children: [_jsx("span", { className: "exp-filters-custom-range__field-label", children: "\u041F\u043E" }), _jsx(DatePicker, { value: dateTo, min: dateFrom || undefined, onChange: setDateTo, portal: true, buttonClassName: "exp-filters-custom-range__picker", emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433" })] })] })] }), error ? _jsx("p", { className: "acct-card__error", children: error }) : null, rows == null && !error ? _jsx("p", { className: "acct-card__empty", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }) : null, rows && visible.length === 0 ? _jsx("p", { className: "acct-card__empty", children: "\u041F\u043E \u044D\u0442\u043E\u0439 \u043A\u0430\u0440\u0442\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442" }) : null, rows && visible.length > 0 ? (_jsx("div", { className: "exp-table acct-card-table", role: "region", "aria-label": "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u043F\u043E \u043A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u0435", children: _jsxs("div", { className: "exp-table__body", children: [_jsxs("div", { className: "exp-table__row exp-table__row--head", role: "row", children: [_jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u0414\u0430\u0442\u0430" }), _jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u041A\u0430\u0440\u0442\u0430 (\u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446)" }), _jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u0412\u0438\u0434 \u0440\u0430\u0441\u0445\u043E\u0434\u0430" }), _jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), _jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" }), _jsx("div", { className: "exp-table__th", role: "columnheader", children: "\u0421\u0443\u043C\u043C\u0430, UZS" })] }), visible.map((row) => (_jsxs("button", { type: "button", className: "exp-table__row acct-card-table__row", onClick: () => openExpense(row), children: [_jsx("span", { children: formatDate(row.expenseDate) }), _jsx("span", { children: cardOwner(row) }), _jsx("span", { children: expenseKind(row) || '—' }), _jsx("span", { className: "acct-card-table__desc", children: expenseDescription(row) }), _jsx("span", { className: `exp-status exp-status--${row.status}`, children: STATUS_META[row.status]?.label ?? row.status }), _jsx("span", { children: PAYMENT_META[(row.paymentMethod ?? '')]?.label ?? (row.paymentMethod || '—') }), _jsx("span", { className: "acct-card__num", children: money(Number(row.amountUzs) || 0) })] }, row.id)))] }) })) : null, panelMounted ? (_jsx(Suspense, { fallback: null, children: _jsx(ExpensesFormPanel, { isOpen: open != null, mode: "view", editingRequest: open, formScope: open?.expenseType === 'partner_expense' ? 'partner' : 'company', onClose: () => setOpen(null), onExited: () => {
                        if (open == null)
                            setPanelMounted(false);
                    }, onSaveDraft: () => { }, onSubmit: () => { }, currentUserId: user?.id ?? null, currentUserRole: user?.role ?? null, currentUserEmail: user?.email ?? null, currentUserDisplayName: user?.display_name ?? null }) })) : null] }));
}
