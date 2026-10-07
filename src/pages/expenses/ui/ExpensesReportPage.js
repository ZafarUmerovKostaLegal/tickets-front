import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '@shared/config';
import { DatePicker } from '@shared/ui';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { ExpensesShell } from './ExpensesShell';
import { fetchAllExpenses } from '@entities/expenses/lib/fetchAllExpenses';
import { applyFilters, DEFAULT_REPORT_CONFIG, exportExpensesCustomTableToExcel, exportExpensesToExcel, } from '@entities/expenses/lib/exportExpenses';
import { EXPENSE_REGISTRY_STATUSES, EXPENSE_TYPES, COMPANY_EXPENSE_TYPES, PAYMENT_METHODS, STATUS_META, TYPE_META, getPartnerExpenseSubtypeLabel, } from '@entities/expenses/model/constants';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { EXPENSE_REPORT_COLUMNS, getColumnDef, getDefaultVisibleColumnIds, normalizeVisibleColumnIds, } from '@entities/expenses/model/expensesReportColumns';
import './ExpensesPage.css';
const ExpensesReportCharts = lazy(() => import('./ExpensesReportCharts').then((m) => ({ default: m.ExpensesReportCharts })));
const LS_COLUMNS = 'kl-expenses-report-columns-v1';
const LS_COLUMNS_PARTNER = 'kl-expenses-partner-report-columns-v1';
const LOAD_PERIOD_OPTIONS = [
    { id: 'all', label: 'Всё время' },
    { id: '90d', label: '90 дней' },
    { id: 'ytd', label: 'С начала года' },
    { id: 'month', label: 'Этот месяц' },
];
const IcoChevLeft = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("polyline", { points: "15 18 9 12 15 6" }) }));
const IcoChevRight = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("polyline", { points: "9 18 15 12 9 6" }) }));
const IcoChevDown = () => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("polyline", { points: "6 9 12 15 18 9" }) }));
function formatMonthRu(isoYm) {
    const [y, m] = isoYm.split('-').map(Number);
    if (!y || !m)
        return isoYm;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
}
function formatUzsCompact(n) {
    if (!Number.isFinite(n))
        return '—';
    const abs = Math.abs(n);
    if (abs >= 1000000000)
        return `${(n / 1000000000).toFixed(2).replace(/\.?0+$/, '')} млрд`;
    if (abs >= 1000000)
        return `${(n / 1000000).toFixed(2).replace(/\.?0+$/, '')} млн`;
    if (abs >= 1000)
        return `${Math.round(n / 1000)} тыс`;
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}
const PIE_COLORS = ['#2c4a6e', '#9a8548', '#4d6b5c', '#6b5e52', '#3d5a80', '#8a6a4a', '#5c6b7a', '#7a5348', '#4a5568'];
const STATUS_OPTIONS = EXPENSE_REGISTRY_STATUSES.map(s => ({
    value: s,
    label: STATUS_META[s].label,
}));
function addDaysIso(iso, delta) {
    const [y, mo, da] = iso.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    d.setDate(d.getDate() + delta);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}
function isoDateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function periodAnchorToRange(period, anchor) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (period === 'all')
        return {};
    if (period === '90d') {
        const dateTo = isoDateLocal(anchor);
        return { dateFrom: addDaysIso(dateTo, -90), dateTo };
    }
    if (period === 'month') {
        const last = new Date(y, m + 1, 0).getDate();
        return { dateFrom: `${y}-${pad(m + 1)}-01`, dateTo: `${y}-${pad(m + 1)}-${pad(last)}` };
    }
    return { dateFrom: `${y}-01-01`, dateTo: isoDateLocal(anchor) };
}
function formatLoadPeriodTitle(period, anchor, customRangeActive, dateFrom, dateTo) {
    if (customRangeActive && dateFrom && dateTo)
        return formatIsoRangeTitle(dateFrom, dateTo);
    if (period === 'all')
        return 'За всё время';
    const range = periodAnchorToRange(period, anchor);
    if (!range.dateFrom || !range.dateTo)
        return 'За всё время';
    const fmt = (s, year = false) => {
        const d = new Date(`${s}T00:00:00`);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
    };
    const labels = {
        '90d': '90 дней',
        ytd: 'С начала года',
        month: 'Этот месяц',
    };
    return `${labels[period]}: ${fmt(range.dateFrom)} — ${fmt(range.dateTo, true)}`;
}
function shiftPeriodAnchor(period, anchor, direction) {
    const next = new Date(anchor);
    if (period === '90d')
        next.setDate(next.getDate() + direction * 90);
    else if (period === 'month')
        next.setMonth(next.getMonth() + direction);
    else if (period === 'ytd')
        next.setFullYear(next.getFullYear() + direction);
    return next;
}
function ReportAllToggle({ id, label, checked, onToggle, }) {
    const labelId = `exp-rep-all-${id}`;
    return (_jsxs("div", { className: "exp-form-switch-row rep-report-all-row", children: [_jsx("span", { id: labelId, className: "rep-report-all-text", children: label }), _jsx("button", { type: "button", role: "switch", "aria-labelledby": labelId, "aria-checked": checked, className: `exp-form-switch${checked ? ' exp-form-switch--on' : ''}`, onClick: () => onToggle(!checked), children: _jsx("span", { className: "exp-form-switch__thumb" }) })] }));
}
export function ExpensesReportPage({ variant = 'company' }) {
    const isPartner = variant === 'partner';
    const columnsLsKey = isPartner ? LS_COLUMNS_PARTNER : LS_COLUMNS;
    const loadRangeId = useId();
    const filterRangeId = useId();
    const periodDropdownRef = useRef(null);
    const [periodGranularity, setPeriodGranularity] = useState('ytd');
    const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
    const [customRangeActive, setCustomRangeActive] = useState(false);
    const [periodDropdown, setPeriodDropdown] = useState(false);
    const initLoadRange = periodAnchorToRange('ytd', new Date());
    const [loadDateFrom, setLoadDateFrom] = useState(initLoadRange.dateFrom ?? '');
    const [loadDateTo, setLoadDateTo] = useState(initLoadRange.dateTo ?? '');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [reportConfig, setReportConfig] = useState(() => ({
        ...DEFAULT_REPORT_CONFIG,
        title: isPartner ? 'Отчёт по расходам партнёров' : DEFAULT_REPORT_CONFIG.title,
    }));
    const [allTypes, setAllTypes] = useState(true);
    const [allStatuses, setAllStatuses] = useState(true);
    const [allPayments, setAllPayments] = useState(true);
    const [visibleIds, setVisibleIds] = useState(() => getDefaultVisibleColumnIds(isPartner ? 'partner' : 'company'));
    const [columnsOpen, setColumnsOpen] = useState(true);
    const [excelBusy, setExcelBusy] = useState('idle');
    const [excelError, setExcelError] = useState(null);
    const presetLoadRange = useMemo(() => periodAnchorToRange(periodGranularity, periodAnchor), [periodGranularity, periodAnchor]);
    const apiRange = useMemo(() => {
        if (periodGranularity === 'all' && !customRangeActive && !loadDateFrom && !loadDateTo)
            return {};
        const out = {};
        if (loadDateFrom)
            out.dateFrom = loadDateFrom;
        if (loadDateTo)
            out.dateTo = loadDateTo;
        return out;
    }, [periodGranularity, customRangeActive, loadDateFrom, loadDateTo]);
    const periodTitle = useMemo(() => formatLoadPeriodTitle(periodGranularity, periodAnchor, customRangeActive, loadDateFrom, loadDateTo), [periodGranularity, periodAnchor, customRangeActive, loadDateFrom, loadDateTo]);
    const activePeriodLabel = LOAD_PERIOD_OPTIONS.find(opt => opt.id === periodGranularity)?.label ?? 'Период';
    useEffect(() => {
        if (customRangeActive)
            return;
        setLoadDateFrom(presetLoadRange.dateFrom ?? '');
        setLoadDateTo(presetLoadRange.dateTo ?? '');
    }, [presetLoadRange.dateFrom, presetLoadRange.dateTo, customRangeActive]);
    useEffect(() => {
        if (customRangeActive)
            return;
        setReportConfig(prev => ({
            ...prev,
            dateFrom: presetLoadRange.dateFrom ?? '',
            dateTo: presetLoadRange.dateTo ?? '',
        }));
    }, [presetLoadRange.dateFrom, presetLoadRange.dateTo, customRangeActive]);
    useEffect(() => {
        if (!periodDropdown)
            return;
        const onPointerDown = (event) => {
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target))
                setPeriodDropdown(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [periodDropdown]);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(columnsLsKey);
            if (raw)
                setVisibleIds(normalizeVisibleColumnIds(JSON.parse(raw), isPartner ? 'partner' : 'company'));
        }
        catch {
        }
    }, [columnsLsKey, isPartner]);
    useEffect(() => {
        try {
            localStorage.setItem(columnsLsKey, JSON.stringify(visibleIds));
        }
        catch {
        }
    }, [visibleIds, columnsLsKey]);
    useEffect(() => {
        const ac = new AbortController();
        let cancelled = false;
        setLoading(true);
        setError(null);
        void fetchAllExpenses({
            ...apiRange,
            sortBy: 'expenseDate',
            sortOrder: 'desc',
            scopeMode: isPartner ? 'partner' : 'company',
        }, ac.signal)
            .then(data => {
            if (!cancelled)
                setItems(data);
        })
            .catch(e => {
            if (e.name === 'AbortError' || cancelled)
                return;
            setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
            setItems([]);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [apiRange, reloadKey, isPartner]);
    const setCfg = useCallback((key, val) => {
        setReportConfig(prev => ({ ...prev, [key]: val }));
    }, []);
    const toggleType = useCallback((type) => {
        setReportConfig(prev => {
            const has = prev.selectedTypes.includes(type);
            return {
                ...prev,
                selectedTypes: has ? prev.selectedTypes.filter(t => t !== type) : [...prev.selectedTypes, type],
            };
        });
    }, []);
    const toggleStatus = useCallback((status) => {
        setReportConfig(prev => {
            const has = prev.selectedStatuses.includes(status);
            return {
                ...prev,
                selectedStatuses: has
                    ? prev.selectedStatuses.filter(s => s !== status)
                    : [...prev.selectedStatuses, status],
            };
        });
    }, []);
    const togglePayment = useCallback((method) => {
        setReportConfig(prev => {
            const has = prev.selectedPaymentMethods.includes(method);
            return {
                ...prev,
                selectedPaymentMethods: has
                    ? prev.selectedPaymentMethods.filter(m => m !== method)
                    : [...prev.selectedPaymentMethods, method],
            };
        });
    }, []);
    const filteredItems = useMemo(() => applyFilters(items, reportConfig), [items, reportConfig]);
    const byType = useMemo(() => {
        const m = new Map();
        for (const r of filteredItems) {
            const label = isPartner
                ? (getPartnerExpenseSubtypeLabel(r.expenseSubtype) || 'Без категории')
                : (TYPE_META[r.expenseType]?.label ?? r.expenseType);
            m.set(label, (m.get(label) ?? 0) + asExpenseNumber(r.amountUzs));
        }
        return [...m.entries()].map(([name, value]) => ({ name, value }));
    }, [filteredItems, isPartner]);
    const byStatus = useMemo(() => {
        const m = new Map();
        for (const r of filteredItems) {
            const key = r.status;
            const label = STATUS_META[key]?.label ?? r.status;
            m.set(label, (m.get(label) ?? 0) + asExpenseNumber(r.amountUzs));
        }
        return [...m.entries()].map(([name, value]) => ({ name, value }));
    }, [filteredItems]);
    const byMonth = useMemo(() => {
        const m = new Map();
        for (const r of filteredItems) {
            const iso = (r.expenseDate ?? '').slice(0, 7);
            if (!/^\d{4}-\d{2}$/.test(iso))
                continue;
            m.set(iso, (m.get(iso) ?? 0) + asExpenseNumber(r.amountUzs));
        }
        const keys = [...m.keys()].sort();
        return keys.map(k => ({ month: k, uzs: m.get(k) ?? 0 }));
    }, [filteredItems]);
    const byMonthLabeled = useMemo(() => byMonth.map(row => ({ ...row, label: formatMonthRu(row.month) })), [byMonth]);
    const byPayment = useMemo(() => {
        const m = new Map();
        for (const r of filteredItems) {
            const raw = r.paymentMethod;
            const label = raw ? (PAYMENT_METHODS.find(p => p.value === raw)?.label ?? raw) : 'Не указан';
            m.set(label, (m.get(label) ?? 0) + asExpenseNumber(r.amountUzs));
        }
        return [...m.entries()].map(([name, value]) => ({ name, value }));
    }, [filteredItems]);
    const byTypeRanked = useMemo(() => [...byType].sort((a, b) => b.value - a.value).slice(0, 10), [byType]);
    const pieStyled = useMemo(() => byType.map((d, i) => ({
        ...d,
        fill: PIE_COLORS[i % PIE_COLORS.length],
    })), [byType]);
    const byStatusSorted = useMemo(() => [...byStatus].sort((a, b) => b.value - a.value), [byStatus]);
    const totals = useMemo(() => filteredItems.reduce((acc, r) => ({
        uzs: acc.uzs + asExpenseNumber(r.amountUzs),
        usd: acc.usd + asExpenseNumber(r.equivalentAmount),
        reimb: acc.reimb + (r.isReimbursable ? 1 : 0),
    }), { uzs: 0, usd: 0, reimb: 0 }), [filteredItems]);
    const reimbPct = filteredItems.length ? Math.round((100 * totals.reimb) / filteredItems.length) : 0;
    const visibleColumns = useMemo(() => visibleIds.map(id => getColumnDef(id)).filter(Boolean), [visibleIds]);
    const periodLabelForExport = useMemo(() => {
        const from = reportConfig.dateFrom || '—';
        const to = reportConfig.dateTo || '—';
        return `Период (дата расхода): ${from} — ${to} · записей после фильтров: ${filteredItems.length} · загружено с сервера: ${items.length}`;
    }, [reportConfig.dateFrom, reportConfig.dateTo, filteredItems.length, items.length]);
    const handleExportFull = useCallback(async () => {
        if (items.length === 0)
            return;
        setExcelBusy('full');
        setExcelError(null);
        try {
            await exportExpensesToExcel(items, reportConfig);
        }
        catch (e) {
            setExcelError(e instanceof Error ? e.message : 'Не удалось сформировать полный отчёт');
        }
        finally {
            setExcelBusy('idle');
        }
    }, [items, reportConfig]);
    const handleExportCustom = useCallback(async () => {
        if (filteredItems.length === 0 || visibleIds.length === 0)
            return;
        setExcelBusy('custom');
        setExcelError(null);
        try {
            await exportExpensesCustomTableToExcel(filteredItems, visibleIds, {
                title: `${reportConfig.title} — выбранные столбцы`,
                subtitle: periodLabelForExport,
            });
        }
        catch (e) {
            setExcelError(e instanceof Error ? e.message : 'Не удалось сформировать таблицу Excel');
        }
        finally {
            setExcelBusy('idle');
        }
    }, [filteredItems, visibleIds, reportConfig.title, periodLabelForExport]);
    const toggleCol = (id) => {
        setVisibleIds(prev => {
            if (prev.includes(id)) {
                if (prev.length <= 1)
                    return prev;
                return prev.filter(x => x !== id);
            }
            return [...prev, id];
        });
    };
    const resetColumns = () => setVisibleIds(getDefaultVisibleColumnIds(isPartner ? 'partner' : 'company'));
    return (_jsx(ExpensesShell, { title: isPartner ? 'Отчёт по расходам партнёров' : 'Отчёты и аналитика', children: _jsxs("div", { className: "exp-report-page", children: [_jsxs("header", { className: "exp-report-hero", children: [_jsx("p", { className: "exp-report-hero__eyebrow", children: isPartner ? 'Расходы партнёров' : 'Расходы компании' }), _jsx("h2", { className: "exp-report-hero__title", children: "\u0421\u0432\u043E\u0434\u043A\u0430 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434" }), _jsx("p", { className: "exp-report-hero__text", children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0438 \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u043F\u043E \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u043C \u0437\u0430\u044F\u0432\u043A\u0430\u043C. \u041D\u0438\u0436\u0435 \u2014 \u0444\u0438\u043B\u044C\u0442\u0440\u044B, \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0430 Excel \u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u0430." })] }), _jsxs("div", { className: "exp-report-nav", children: [_jsx(NavLink, { to: routes.expenses, className: "exp-report-nav__link", children: "\u2190 \u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438" }), _jsx(NavLink, { to: routes.expensesPartners, className: "exp-report-nav__link exp-report-nav__link--muted", children: "\u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432" })] }), _jsxs("section", { className: "exp-report-panel exp-report-panel--compact", "aria-labelledby": "exp-report-load-title", children: [_jsx("h3", { id: "exp-report-load-title", className: "exp-report-panel__title", children: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0434\u0430\u043D\u043D\u044B\u0445" }), _jsx("p", { className: "exp-report-panel__hint", children: "\u041F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043A API \u043F\u043E \u0434\u0430\u0442\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u0430. \u0424\u0438\u043B\u044C\u0442\u0440\u044B \u043D\u0438\u0436\u0435 \u0443\u0442\u043E\u0447\u043D\u044F\u044E\u0442 \u0432\u044B\u0431\u043E\u0440\u043A\u0443 \u043D\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u0435." }), _jsxs("div", { className: "tt-reports__header", children: [_jsxs("div", { className: "tt-reports__header-left", children: [_jsx("button", { type: "button", className: "tt-reports__nav-btn", onClick: () => {
                                                setCustomRangeActive(false);
                                                setPeriodAnchor(prev => shiftPeriodAnchor(periodGranularity, prev, -1));
                                            }, disabled: periodGranularity === 'all', "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", children: _jsx(IcoChevLeft, {}) }), _jsx("h2", { className: "tt-reports__period-title", children: periodTitle }), _jsx("button", { type: "button", className: "tt-reports__nav-btn", onClick: () => {
                                                setCustomRangeActive(false);
                                                setPeriodAnchor(prev => shiftPeriodAnchor(periodGranularity, prev, 1));
                                            }, disabled: periodGranularity === 'all', "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", children: _jsx(IcoChevRight, {}) })] }), _jsxs("div", { className: "tt-reports__header-right", children: [_jsxs("div", { className: "tt-reports__period-dropdown-wrap", ref: periodDropdownRef, children: [_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown", onClick: () => setPeriodDropdown(open => !open), "aria-expanded": periodDropdown, children: [activePeriodLabel, " ", _jsx(IcoChevDown, {})] }), periodDropdown ? (_jsx("div", { className: "tt-reports__period-dropdown", role: "listbox", children: LOAD_PERIOD_OPTIONS.map(opt => (_jsx("button", { type: "button", role: "option", "aria-selected": periodGranularity === opt.id, className: `tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`, onClick: () => {
                                                            setCustomRangeActive(false);
                                                            setPeriodGranularity(opt.id);
                                                            setPeriodAnchor(new Date());
                                                            setPeriodDropdown(false);
                                                        }, children: opt.label }, opt.id))) })) : null] }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => setReloadKey(k => k + 1), disabled: loading, children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435" })] })] }), _jsxs("div", { className: "tt-reports__date-range", "aria-label": "\u041F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445", children: [_jsx("span", { className: "tt-reports__date-range-title", children: "\u0414\u0430\u0442\u044B \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsxs("div", { className: "tt-reports__date-field", children: [_jsx("span", { className: "tt-reports__date-field-label", id: `${loadRangeId}-from`, children: "\u0421" }), _jsx(DatePicker, { value: loadDateFrom, max: loadDateTo || undefined, onChange: (iso) => {
                                                setLoadDateFrom(iso);
                                                if (loadDateTo && iso > loadDateTo)
                                                    setLoadDateTo(iso);
                                                setCustomRangeActive(true);
                                            }, "aria-labelledby": `${loadRangeId}-from`, portal: true, buttonClassName: "tt-reports__date-picker-btn" })] }), _jsxs("div", { className: "tt-reports__date-field", children: [_jsx("span", { className: "tt-reports__date-field-label", id: `${loadRangeId}-to`, children: "\u041F\u043E" }), _jsx(DatePicker, { value: loadDateTo, min: loadDateFrom || undefined, onChange: (iso) => {
                                                setLoadDateTo(iso);
                                                if (loadDateFrom && iso < loadDateFrom)
                                                    setLoadDateFrom(iso);
                                                setCustomRangeActive(true);
                                            }, "aria-labelledby": `${loadRangeId}-to`, portal: true, buttonClassName: "tt-reports__date-picker-btn" })] }), customRangeActive ? (_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => {
                                        setCustomRangeActive(false);
                                        setPeriodAnchor(new Date());
                                    }, children: ["\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043A ", activePeriodLabel.toLowerCase()] })) : null] })] }), error && (_jsx("div", { className: "exp-error-banner", role: "alert", children: error })), _jsx("div", { className: "exp-report-kpi-strip", "aria-label": "\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438", children: _jsxs("div", { className: "exp-report-stats exp-report-stats--4 exp-report-stats--kpi", children: [_jsxs("div", { className: "exp-report-stat-card exp-report-stat-card--kpi", children: [_jsx("span", { className: "exp-report-stat-card__label", children: "\u0417\u0430\u044F\u0432\u043E\u043A \u0432 \u0432\u044B\u0431\u043E\u0440\u043A\u0435" }), _jsx("span", { className: "exp-report-stat-card__value", children: loading ? '…' : filteredItems.length.toLocaleString('ru-RU') }), _jsx("span", { className: "exp-report-stat-card__sub", children: loading ? '' : `из ${items.length.toLocaleString('ru-RU')} загруженных` })] }), _jsxs("div", { className: "exp-report-stat-card exp-report-stat-card--kpi exp-report-stat-card--emphasis", children: [_jsx("span", { className: "exp-report-stat-card__label", children: "\u0421\u0443\u043C\u043C\u0430, UZS" }), _jsx("span", { className: "exp-report-stat-card__value", children: loading ? '…' : formatUzsCompact(totals.uzs) }), _jsx("span", { className: "exp-report-stat-card__sub", children: loading ? '' : totals.uzs.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) })] }), _jsxs("div", { className: "exp-report-stat-card exp-report-stat-card--kpi", children: [_jsx("span", { className: "exp-report-stat-card__label", children: "\u042D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442, USD" }), _jsx("span", { className: "exp-report-stat-card__value", children: loading ? '…' : totals.usd.toFixed(2) })] }), _jsxs("div", { className: "exp-report-stat-card exp-report-stat-card--kpi", children: [_jsx("span", { className: "exp-report-stat-card__label", children: "\u0412\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u044B\u0435" }), _jsx("span", { className: "exp-report-stat-card__value", children: loading ? '…' : `${reimbPct}%` })] })] }) }), _jsxs("section", { className: "exp-report-analytics", "aria-labelledby": "exp-report-analytics-title", children: [_jsxs("div", { className: "exp-report-analytics__head", children: [_jsx("h2", { id: "exp-report-analytics-title", className: "exp-report-analytics__title", children: "\u0413\u0440\u0430\u0444\u0438\u043A\u0438" }), _jsx("p", { className: "exp-report-analytics__lead", children: loading
                                        ? 'Загрузка данных…'
                                        : filteredItems.length === 0
                                            ? 'Нет строк под текущие фильтры. Измените условия или период загрузки.'
                                            : `${filteredItems.length.toLocaleString('ru-RU')} заявок, суммы в UZS. Наведите на элемент, чтобы увидеть точное значение.` })] }), loading && (_jsx("div", { className: "exp-report-analytics__skeleton", "aria-hidden": true, children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "exp-report-skel-card" }, i))) })), !loading && filteredItems.length > 0 && (_jsx(Suspense, { fallback: _jsx("div", { className: "exp-report-analytics__skeleton", "aria-hidden": true, children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "exp-report-skel-card" }, i))) }), children: _jsx(ExpensesReportCharts, { pieStyled: pieStyled, byTypeRanked: byTypeRanked, byMonthLabeled: byMonthLabeled, byStatusSorted: byStatusSorted, byPayment: byPayment }) }))] }), _jsxs("section", { className: "exp-report-panel", "aria-labelledby": "exp-report-filters-title", children: [_jsx("h3", { id: "exp-report-filters-title", className: "exp-report-panel__title", children: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsxs("p", { className: "exp-report-panel__hint", children: ["\u041A\u0430\u043A \u0432 \u043E\u043A\u043D\u0435 \u00AB\u041E\u0442\u0447\u0451\u0442 Excel\u00BB \u043D\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0435. \u0421\u0435\u0439\u0447\u0430\u0441 \u0432 \u0432\u044B\u0431\u043E\u0440\u043A\u0435", ' ', _jsxs("strong", { children: [filteredItems.length, " \u0438\u0437 ", items.length] }), ' ', "\u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0445 \u0441\u0442\u0440\u043E\u043A."] }), _jsxs("div", { className: "exp-report-filters", children: [_jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043E\u0442\u0447\u0451\u0442\u0430 Excel" }), _jsx("input", { type: "text", className: "rep-input", value: reportConfig.title, onChange: e => setCfg('title', e.target.value), placeholder: DEFAULT_REPORT_CONFIG.title })] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u041F\u0435\u0440\u0438\u043E\u0434 \u0432 \u043E\u0442\u0447\u0451\u0442\u0435 (\u0434\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430)" }), _jsx("p", { className: "rep-field-hint", style: { marginTop: 0 }, children: "\u041F\u0443\u0441\u0442\u043E\u0435 \u00AB\u0421\u00BB / \u00AB\u041F\u043E\u00BB \u2014 \u0431\u0435\u0437 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0441 \u044D\u0442\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u044B." }), _jsxs("div", { className: "tt-reports__date-range", "aria-label": "\u041F\u0435\u0440\u0438\u043E\u0434 \u0432 \u043E\u0442\u0447\u0451\u0442\u0435", children: [_jsx("span", { className: "tt-reports__date-range-title", children: "\u0414\u0430\u0442\u044B \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsxs("div", { className: "tt-reports__date-field", children: [_jsx("span", { className: "tt-reports__date-field-label", id: `${filterRangeId}-from`, children: "\u0421" }), _jsx(DatePicker, { value: reportConfig.dateFrom, max: reportConfig.dateTo || undefined, onChange: (iso) => setCfg('dateFrom', iso), "aria-labelledby": `${filterRangeId}-from`, portal: true, buttonClassName: "tt-reports__date-picker-btn" })] }), _jsxs("div", { className: "tt-reports__date-field", children: [_jsx("span", { className: "tt-reports__date-field-label", id: `${filterRangeId}-to`, children: "\u041F\u043E" }), _jsx(DatePicker, { value: reportConfig.dateTo, min: reportConfig.dateFrom || undefined, onChange: (iso) => setCfg('dateTo', iso), "aria-labelledby": `${filterRangeId}-to`, portal: true, buttonClassName: "tt-reports__date-picker-btn" })] })] })] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0422\u0438\u043F\u044B \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432" }), _jsx(ReportAllToggle, { id: "types", label: "\u0412\u0441\u0435 \u0442\u0438\u043F\u044B", checked: allTypes, onToggle: next => {
                                                setAllTypes(next);
                                                if (next)
                                                    setReportConfig(prev => ({ ...prev, selectedTypes: [] }));
                                            } }), !allTypes && (_jsx("div", { className: "rep-check-grid rep-check-grid--wide", children: (!isPartner ? COMPANY_EXPENSE_TYPES : EXPENSE_TYPES.filter(t => t.value === 'partner_expense')).map(t => (_jsxs("label", { className: `rep-check${reportConfig.selectedTypes.includes(t.value) ? ' rep-check--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: reportConfig.selectedTypes.includes(t.value), onChange: () => toggleType(t.value) }), _jsx("span", { children: t.label })] }, t.value))) }))] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0421\u0442\u0430\u0442\u0443\u0441\u044B" }), _jsx(ReportAllToggle, { id: "statuses", label: "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B", checked: allStatuses, onToggle: next => {
                                                setAllStatuses(next);
                                                if (next)
                                                    setReportConfig(prev => ({ ...prev, selectedStatuses: [] }));
                                            } }), !allStatuses && (_jsx("div", { className: "rep-check-grid rep-check-grid--wide", children: STATUS_OPTIONS.map(s => (_jsxs("label", { className: `rep-check${reportConfig.selectedStatuses.includes(s.value) ? ' rep-check--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: reportConfig.selectedStatuses.includes(s.value), onChange: () => toggleStatus(s.value) }), _jsx("span", { className: `exp-status exp-status--${s.value}`, children: s.label })] }, s.value))) }))] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" }), _jsx(ReportAllToggle, { id: "payments", label: "\u0412\u0441\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u044B", checked: allPayments, onToggle: next => {
                                                setAllPayments(next);
                                                if (next)
                                                    setReportConfig(prev => ({ ...prev, selectedPaymentMethods: [] }));
                                            } }), !allPayments && (_jsx("div", { className: "rep-check-grid rep-check-grid--wide", children: PAYMENT_METHODS.map(m => (_jsxs("label", { className: `rep-check${reportConfig.selectedPaymentMethods.includes(m.value) ? ' rep-check--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: reportConfig.selectedPaymentMethods.includes(m.value), onChange: () => togglePayment(m.value) }), _jsx("span", { children: m.label })] }, m.value))) }))] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0412\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u043E\u0441\u0442\u044C" }), _jsx("div", { className: "rep-radio-row rep-radio-row--wide", children: [
                                                ['all', 'Все'],
                                                ['reimbursable', 'Возмещаемые'],
                                                ['non_reimbursable', 'Невозмещаемые'],
                                            ].map(([val, lab]) => (_jsxs("label", { className: `rep-radio${reportConfig.reimbursable === val ? ' rep-radio--on' : ''}`, children: [_jsx("input", { type: "radio", name: "reimbursable", value: val, checked: reportConfig.reimbursable === val, onChange: () => setCfg('reimbursable', val) }), lab] }, val))) })] })] })] }), _jsxs("section", { className: "exp-report-panel exp-report-panel--excel", "aria-labelledby": "exp-report-excel-title", children: [_jsx("h3", { id: "exp-report-excel-title", className: "exp-report-panel__title", children: "\u0412\u044B\u0433\u0440\u0443\u0437\u043A\u0430 \u0432 Excel (.xlsx)" }), _jsxs("p", { className: "exp-report-panel__hint", children: [_jsx("strong", { children: "\u041F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442" }), " \u2014 \u0434\u0432\u0430 \u043B\u0438\u0441\u0442\u0430: \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430 (\u0432\u0441\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438, \u043A\u0430\u043A \u0432 \u043C\u043E\u0434\u0430\u043B\u044C\u043D\u043E\u043C \u043E\u043A\u043D\u0435 \u043D\u0430 \u0440\u0435\u0435\u0441\u0442\u0440\u0435) \u0438 \u0441\u0432\u043E\u0434\u043A\u0430 \u043F\u043E \u0442\u0438\u043F\u0430\u043C / \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043C / \u0432\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u043E\u0441\u0442\u0438. ", _jsx("strong", { children: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0441 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u043C\u0438 \u0441\u0442\u043E\u043B\u0431\u0446\u0430\u043C\u0438" }), " \u2014 \u043E\u0434\u0438\u043D \u043B\u0438\u0441\u0442 \u043F\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u043C \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u043D\u0438\u0436\u0435."] }), _jsxs("div", { className: "exp-report-excel-actions", children: [_jsx("button", { type: "button", className: "exp-report-btn-excel exp-report-btn-excel--full", onClick: () => void handleExportFull(), disabled: loading || items.length === 0 || excelBusy !== 'idle', children: excelBusy === 'full' ? 'Формируем…' : 'Скачать полный отчёт Excel' }), _jsx("button", { type: "button", className: "exp-report-btn-excel exp-report-btn-excel--custom", onClick: () => void handleExportCustom(), disabled: loading || filteredItems.length === 0 || visibleIds.length === 0 || excelBusy !== 'idle', children: excelBusy === 'custom' ? 'Формируем…' : 'Скачать Excel: выбранные столбцы' })] }), excelError && (_jsx("p", { className: "exp-report-excel-error", role: "alert", children: excelError }))] }), !loading && filteredItems.length === 0 && !error && (_jsx("p", { className: "exp-report-empty", children: "\u041D\u0435\u0442 \u0437\u0430\u044F\u0432\u043E\u043A, \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u043F\u043E\u0434 \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u044B." })), _jsxs("section", { className: "exp-report-section", "aria-labelledby": "exp-report-table-title", children: [_jsxs("div", { className: "exp-report-section__head", children: [_jsx("h2", { id: "exp-report-table-title", className: "exp-report-section__title", children: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0438 \u0441\u0442\u043E\u043B\u0431\u0446\u044B Excel" }), _jsx("p", { className: "exp-report-section__lead", children: "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0441\u0442\u043E\u043B\u0431\u0446\u044B \u0434\u043B\u044F \u043F\u0440\u0435\u0432\u044C\u044E \u0438 \u0434\u043B\u044F \u043A\u043D\u043E\u043F\u043A\u0438 \u00AB\u0421\u043A\u0430\u0447\u0430\u0442\u044C Excel: \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u0441\u0442\u043E\u043B\u0431\u0446\u044B\u00BB. \u041D\u0430\u0431\u043E\u0440 \u0441\u0442\u043E\u043B\u0431\u0446\u043E\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435. CSV \u0438 \u0434\u0440\u0443\u0433\u0438\u0435 \u0444\u043E\u0440\u043C\u0430\u0442\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u2014 \u0442\u043E\u043B\u044C\u043A\u043E .xlsx." })] }), _jsxs("div", { className: "exp-report-columns", children: [_jsxs("button", { type: "button", className: "exp-report-columns__toggle", "aria-expanded": columnsOpen, onClick: () => setColumnsOpen(o => !o), children: ["\u0421\u0442\u043E\u043B\u0431\u0446\u044B (", visibleIds.length, ")"] }), columnsOpen && (_jsx("div", { className: "exp-report-columns__grid", children: EXPENSE_REPORT_COLUMNS.map(col => (_jsxs("label", { className: "exp-report-col-check", children: [_jsx("input", { type: "checkbox", checked: visibleIds.includes(col.id), onChange: () => toggleCol(col.id) }), _jsx("span", { children: col.label })] }, col.id))) })), _jsx("div", { className: "exp-report-columns__actions", children: _jsx("button", { type: "button", className: "exp-report-btn-secondary", onClick: resetColumns, children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0442\u043E\u043B\u0431\u0446\u044B" }) })] }), _jsx("div", { className: "exp-report-table-wrap", children: loading ? (_jsx("p", { className: "exp-report-table-placeholder", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" })) : filteredItems.length === 0 ? (_jsx("p", { className: "exp-report-table-placeholder", children: "\u041D\u0435\u0442 \u0441\u0442\u0440\u043E\u043A \u0434\u043B\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F." })) : (_jsx("div", { className: "exp-report-table-scroll", children: _jsxs("table", { className: "exp-report-table", children: [_jsx("thead", { children: _jsx("tr", { children: visibleColumns.map(c => (_jsx("th", { style: { minWidth: c.minWidth }, children: c.label }, c.id))) }) }), _jsx("tbody", { children: filteredItems.map(r => (_jsx("tr", { children: visibleColumns.map(c => (_jsx("td", { children: c.value(r) }, c.id))) }, r.id))) })] }) })) })] })] }) }));
}
