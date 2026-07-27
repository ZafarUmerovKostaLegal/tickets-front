import { useCallback, useEffect, useId, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '@shared/config';
import { DatePicker } from '@shared/ui';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { ExpensesShell } from './ExpensesShell';
import { fetchAllExpenses } from '@entities/expenses/lib/fetchAllExpenses';
import { applyFilters, DEFAULT_REPORT_CONFIG, exportExpensesCustomTableToExcel, exportExpensesToExcel, type ReportConfig, } from '@entities/expenses/lib/exportExpenses';
import type { ExpenseRequest, ExpenseStatus, ExpenseType, PaymentMethod } from '@entities/expenses/model/types';
import { EXPENSE_TYPES, COMPANY_EXPENSE_TYPES, PAYMENT_METHODS, STATUS_META, TYPE_META, getPartnerExpenseSubtypeLabel, } from '@entities/expenses/model/constants';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { EXPENSE_REPORT_COLUMNS, getColumnDef, getDefaultVisibleColumnIds, normalizeVisibleColumnIds, type ExpenseReportColumnId, } from '@entities/expenses/model/expensesReportColumns';
import './ExpensesPage.css';

const ExpensesReportCharts = lazy(() => import('./ExpensesReportCharts').then((m) => ({ default: m.ExpensesReportCharts })));

const LS_COLUMNS = 'kl-expenses-report-columns-v1';
const LS_COLUMNS_PARTNER = 'kl-expenses-partner-report-columns-v1';
const LOAD_PERIOD_OPTIONS = [
    { id: 'all', label: 'Всё время' },
    { id: '90d', label: '90 дней' },
    { id: 'ytd', label: 'С начала года' },
    { id: 'month', label: 'Этот месяц' },
] as const;
const IcoChevLeft = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <polyline points="15 18 9 12 15 6"/>
  </svg>);
const IcoChevRight = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <polyline points="9 18 15 12 9 6"/>
  </svg>);
const IcoChevDown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <polyline points="6 9 12 15 18 9"/>
  </svg>);
function formatMonthRu(isoYm: string): string {
    const [y, m] = isoYm.split('-').map(Number);
    if (!y || !m)
        return isoYm;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
}
function formatUzsCompact(n: number): string {
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
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#94a3b8'];
const STATUS_OPTIONS = (Object.keys(STATUS_META) as ExpenseStatus[]).map(s => ({
    value: s,
    label: STATUS_META[s].label,
}));
type DataPeriod = 'all' | '90d' | 'ytd' | 'month';
function addDaysIso(iso: string, delta: number): string {
    const [y, mo, da] = iso.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    d.setDate(d.getDate() + delta);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}
function isoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function periodAnchorToRange(period: DataPeriod, anchor: Date): {
    dateFrom?: string;
    dateTo?: string;
} {
    const pad = (n: number) => String(n).padStart(2, '0');
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
function formatLoadPeriodTitle(period: DataPeriod, anchor: Date, customRangeActive: boolean, dateFrom: string, dateTo: string): string {
    if (customRangeActive && dateFrom && dateTo)
        return formatIsoRangeTitle(dateFrom, dateTo);
    if (period === 'all')
        return 'За всё время';
    const range = periodAnchorToRange(period, anchor);
    if (!range.dateFrom || !range.dateTo)
        return 'За всё время';
    const fmt = (s: string, year = false) => {
        const d = new Date(`${s}T00:00:00`);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
    };
    const labels: Record<Exclude<DataPeriod, 'all'>, string> = {
        '90d': '90 дней',
        ytd: 'С начала года',
        month: 'Этот месяц',
    };
    return `${labels[period]}: ${fmt(range.dateFrom)} — ${fmt(range.dateTo, true)}`;
}
function shiftPeriodAnchor(period: DataPeriod, anchor: Date, direction: -1 | 1): Date {
    const next = new Date(anchor);
    if (period === '90d')
        next.setDate(next.getDate() + direction * 90);
    else if (period === 'month')
        next.setMonth(next.getMonth() + direction);
    else if (period === 'ytd')
        next.setFullYear(next.getFullYear() + direction);
    return next;
}
function ReportAllToggle({ id, label, checked, onToggle, }: {
    id: string;
    label: string;
    checked: boolean;
    onToggle: (next: boolean) => void;
}) {
    const labelId = `exp-rep-all-${id}`;
    return (<div className="exp-form-switch-row rep-report-all-row">
      <span id={labelId} className="rep-report-all-text">
        {label}
      </span>
      <button type="button" role="switch" aria-labelledby={labelId} aria-checked={checked} className={`exp-form-switch${checked ? ' exp-form-switch--on' : ''}`} onClick={() => onToggle(!checked)}>
        <span className="exp-form-switch__thumb"/>
      </button>
    </div>);
}
export function ExpensesReportPage({ variant = 'company' }: { variant?: 'company' | 'partner' }) {
    const isPartner = variant === 'partner';
    const columnsLsKey = isPartner ? LS_COLUMNS_PARTNER : LS_COLUMNS;
    const loadRangeId = useId();
    const filterRangeId = useId();
    const periodDropdownRef = useRef<HTMLDivElement>(null);
    const [periodGranularity, setPeriodGranularity] = useState<DataPeriod>('ytd');
    const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
    const [customRangeActive, setCustomRangeActive] = useState(false);
    const [periodDropdown, setPeriodDropdown] = useState(false);
    const initLoadRange = periodAnchorToRange('ytd', new Date());
    const [loadDateFrom, setLoadDateFrom] = useState(initLoadRange.dateFrom ?? '');
    const [loadDateTo, setLoadDateTo] = useState(initLoadRange.dateTo ?? '');
    const [items, setItems] = useState<ExpenseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [reportConfig, setReportConfig] = useState<ReportConfig>(() => ({
        ...DEFAULT_REPORT_CONFIG,
        title: isPartner ? 'Отчёт по расходам партнёров' : DEFAULT_REPORT_CONFIG.title,
    }));
    const [allTypes, setAllTypes] = useState(true);
    const [allStatuses, setAllStatuses] = useState(true);
    const [allPayments, setAllPayments] = useState(true);
    const [visibleIds, setVisibleIds] = useState<ExpenseReportColumnId[]>(() => getDefaultVisibleColumnIds(isPartner ? 'partner' : 'company'));
    const [columnsOpen, setColumnsOpen] = useState(true);
    const [excelBusy, setExcelBusy] = useState<'idle' | 'full' | 'custom'>('idle');
    const [excelError, setExcelError] = useState<string | null>(null);
    const presetLoadRange = useMemo(() => periodAnchorToRange(periodGranularity, periodAnchor), [periodGranularity, periodAnchor]);
    const apiRange = useMemo(() => {
        if (periodGranularity === 'all' && !customRangeActive && !loadDateFrom && !loadDateTo)
            return {};
        const out: {
            dateFrom?: string;
            dateTo?: string;
        } = {};
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
        const onPointerDown = (event: MouseEvent) => {
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node))
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
            if ((e as Error).name === 'AbortError' || cancelled)
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
    const setCfg = useCallback(<K extends keyof ReportConfig>(key: K, val: ReportConfig[K]) => {
        setReportConfig(prev => ({ ...prev, [key]: val }));
    }, []);
    const toggleType = useCallback((type: ExpenseType) => {
        setReportConfig(prev => {
            const has = prev.selectedTypes.includes(type);
            return {
                ...prev,
                selectedTypes: has ? prev.selectedTypes.filter(t => t !== type) : [...prev.selectedTypes, type],
            };
        });
    }, []);
    const toggleStatus = useCallback((status: ExpenseStatus) => {
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
    const togglePayment = useCallback((method: PaymentMethod) => {
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
        const m = new Map<string, number>();
        for (const r of filteredItems) {
            const label = isPartner
                ? (getPartnerExpenseSubtypeLabel(r.expenseSubtype) || 'Без категории')
                : (TYPE_META[r.expenseType as ExpenseType]?.label ?? r.expenseType);
            m.set(label, (m.get(label) ?? 0) + asExpenseNumber(r.amountUzs));
        }
        return [...m.entries()].map(([name, value]) => ({ name, value }));
    }, [filteredItems, isPartner]);
    const byStatus = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of filteredItems) {
            const key = r.status as ExpenseStatus;
            const label = STATUS_META[key]?.label ?? r.status;
            m.set(label, (m.get(label) ?? 0) + asExpenseNumber(r.amountUzs));
        }
        return [...m.entries()].map(([name, value]) => ({ name, value }));
    }, [filteredItems]);
    const byMonth = useMemo(() => {
        const m = new Map<string, number>();
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
        const m = new Map<string, number>();
        for (const r of filteredItems) {
            const raw = (r.paymentMethod ?? 'other_payment') as PaymentMethod;
            const label = PAYMENT_METHODS.find(p => p.value === raw)?.label ?? raw;
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
    const visibleColumns = useMemo(() => visibleIds.map(id => getColumnDef(id)).filter(Boolean) as typeof EXPENSE_REPORT_COLUMNS, [visibleIds]);
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
    const toggleCol = (id: ExpenseReportColumnId) => {
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
    return (<ExpensesShell title={isPartner ? 'Отчёт по расходам партнёров' : 'Отчёты и аналитика'}>
      <div className="exp-report-page">
        <header className="exp-report-hero exp-report-hero--visual">
          <div className="exp-report-hero__grid">
            <div className="exp-report-hero__copy">
              <p className="exp-report-hero__eyebrow">Расходы компании</p>
              <h2 className="exp-report-hero__title">Аналитика и визуализация</h2>
              <p className="exp-report-hero__text">
                Живая панель графиков по выбранным заявкам: структура расходов, статусы, способы оплаты и динамика по
                месяцам. Ниже — фильтры, Excel <strong>.xlsx</strong> и таблица-превью.
              </p>
            </div>
            <div className="exp-report-hero__accent" aria-hidden>
              <div className="exp-report-hero__orb exp-report-hero__orb--a"/>
              <div className="exp-report-hero__orb exp-report-hero__orb--b"/>
            </div>
          </div>
        </header>

        <div className="exp-report-nav">
          <NavLink to={routes.expenses} className="exp-report-nav__link">
            ← Расходы компании
          </NavLink>
          <NavLink to={routes.expensesRequests} className="exp-report-nav__link exp-report-nav__link--muted">
            На согласование
          </NavLink>
        </div>

        <section className="exp-report-panel exp-report-panel--compact" aria-labelledby="exp-report-load-title">
          <h3 id="exp-report-load-title" className="exp-report-panel__title">
            Источник данных
          </h3>
          <p className="exp-report-panel__hint">
            Период запроса к API по дате расхода. Фильтры ниже уточняют выборку на клиенте.
          </p>

          <div className="tt-reports__header">
            <div className="tt-reports__header-left">
              <button type="button" className="tt-reports__nav-btn" onClick={() => {
            setCustomRangeActive(false);
            setPeriodAnchor(prev => shiftPeriodAnchor(periodGranularity, prev, -1));
        }} disabled={periodGranularity === 'all'} aria-label="Предыдущий период">
                <IcoChevLeft />
              </button>
              <h2 className="tt-reports__period-title">{periodTitle}</h2>
              <button type="button" className="tt-reports__nav-btn" onClick={() => {
            setCustomRangeActive(false);
            setPeriodAnchor(prev => shiftPeriodAnchor(periodGranularity, prev, 1));
        }} disabled={periodGranularity === 'all'} aria-label="Следующий период">
                <IcoChevRight />
              </button>
            </div>
            <div className="tt-reports__header-right">
              <div className="tt-reports__period-dropdown-wrap" ref={periodDropdownRef}>
                <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown" onClick={() => setPeriodDropdown(open => !open)} aria-expanded={periodDropdown}>
                  {activePeriodLabel} <IcoChevDown />
                </button>
                {periodDropdown ? (<div className="tt-reports__period-dropdown" role="listbox">
                    {LOAD_PERIOD_OPTIONS.map(opt => (<button key={opt.id} type="button" role="option" aria-selected={periodGranularity === opt.id} className={`tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`} onClick={() => {
                    setCustomRangeActive(false);
                    setPeriodGranularity(opt.id);
                    setPeriodAnchor(new Date());
                    setPeriodDropdown(false);
                }}>
                        {opt.label}
                      </button>))}
                  </div>) : null}
              </div>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setReloadKey(k => k + 1)} disabled={loading}>
                Обновить данные
              </button>
            </div>
          </div>

          <div className="tt-reports__date-range" aria-label="Период загрузки данных">
            <span className="tt-reports__date-range-title">Даты отчёта</span>
            <div className="tt-reports__date-field">
              <span className="tt-reports__date-field-label" id={`${loadRangeId}-from`}>
                С
              </span>
              <DatePicker value={loadDateFrom} max={loadDateTo || undefined} onChange={(iso) => {
            setLoadDateFrom(iso);
            if (loadDateTo && iso > loadDateTo)
                setLoadDateTo(iso);
            setCustomRangeActive(true);
        }} aria-labelledby={`${loadRangeId}-from`} portal buttonClassName="tt-reports__date-picker-btn"/>
            </div>
            <div className="tt-reports__date-field">
              <span className="tt-reports__date-field-label" id={`${loadRangeId}-to`}>
                По
              </span>
              <DatePicker value={loadDateTo} min={loadDateFrom || undefined} onChange={(iso) => {
            setLoadDateTo(iso);
            if (loadDateFrom && iso < loadDateFrom)
                setLoadDateFrom(iso);
            setCustomRangeActive(true);
        }} aria-labelledby={`${loadRangeId}-to`} portal buttonClassName="tt-reports__date-picker-btn"/>
            </div>
            {customRangeActive ? (<button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => {
            setCustomRangeActive(false);
            setPeriodAnchor(new Date());
        }}>
                Вернуть к {activePeriodLabel.toLowerCase()}
              </button>) : null}
          </div>
        </section>

        {error && (<div className="exp-error-banner" role="alert">
            {error}
          </div>)}

        <div className="exp-report-kpi-strip" aria-label="Ключевые показатели">
          <div className="exp-report-stats exp-report-stats--4 exp-report-stats--kpi">
            <div className="exp-report-stat-card exp-report-stat-card--kpi">
              <span className="exp-report-stat-card__label">Заявок в выборке</span>
              <span className="exp-report-stat-card__value">
                {loading ? '…' : filteredItems.length.toLocaleString('ru-RU')}
              </span>
              <span className="exp-report-stat-card__sub">
                {loading ? '' : `из ${items.length.toLocaleString('ru-RU')} загруженных`}
              </span>
            </div>
            <div className="exp-report-stat-card exp-report-stat-card--kpi exp-report-stat-card--accent">
              <span className="exp-report-stat-card__label">Сумма, UZS</span>
              <span className="exp-report-stat-card__value">
                {loading ? '…' : formatUzsCompact(totals.uzs)}
              </span>
              <span className="exp-report-stat-card__sub">
                {loading ? '' : totals.uzs.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="exp-report-stat-card exp-report-stat-card--kpi">
              <span className="exp-report-stat-card__label">Эквивалент, USD</span>
              <span className="exp-report-stat-card__value">{loading ? '…' : totals.usd.toFixed(2)}</span>
            </div>
            <div className="exp-report-stat-card exp-report-stat-card--kpi">
              <span className="exp-report-stat-card__label">Возмещаемые</span>
              <span className="exp-report-stat-card__value">{loading ? '…' : `${reimbPct}%`}</span>
            </div>
          </div>
        </div>

        <section className="exp-report-analytics" aria-labelledby="exp-report-analytics-title">
          <div className="exp-report-analytics__head">
            <h2 id="exp-report-analytics-title" className="exp-report-analytics__title">
              Панель графиков
            </h2>
            <p className="exp-report-analytics__lead">
              {loading
            ? 'Загружаем данные…'
            : filteredItems.length === 0
                ? 'Нет строк под фильтры — ослабьте условия или обновите период загрузки.'
                : `Визуализация по ${filteredItems.length.toLocaleString('ru-RU')} заявкам (UZS). Наведите на элементы для точных сумм.`}
            </p>
          </div>

          {loading && (<div className="exp-report-analytics__skeleton" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="exp-report-skel-card"/>))}
            </div>)}

          {!loading && filteredItems.length > 0 && (
            <Suspense fallback={<div className="exp-report-analytics__skeleton" aria-hidden>{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="exp-report-skel-card" />))}</div>}>
              <ExpensesReportCharts
                pieStyled={pieStyled}
                byTypeRanked={byTypeRanked}
                byMonthLabeled={byMonthLabeled}
                byStatusSorted={byStatusSorted}
                byPayment={byPayment}
              />
            </Suspense>
          )}
        </section>

        <section className="exp-report-panel" aria-labelledby="exp-report-filters-title">
          <h3 id="exp-report-filters-title" className="exp-report-panel__title">
            Фильтры отчёта
          </h3>
          <p className="exp-report-panel__hint">
            Как в окне «Отчёт Excel» на реестре. Сейчас в выборке{' '}
            <strong>
              {filteredItems.length} из {items.length}
            </strong>{' '}
            загруженных строк.
          </p>

          <div className="exp-report-filters">
            <div className="rep-field">
              <label className="rep-label">Название для полного отчёта Excel</label>
              <input type="text" className="rep-input" value={reportConfig.title} onChange={e => setCfg('title', e.target.value)} placeholder={DEFAULT_REPORT_CONFIG.title}/>
            </div>

            <div className="rep-field">
              <label className="rep-label">Период в отчёте (дата расхода)</label>
              <p className="rep-field-hint" style={{ marginTop: 0 }}>
                Пустое «С» / «По» — без границы с этой стороны.
              </p>
              <div className="tt-reports__date-range" aria-label="Период в отчёте">
                <span className="tt-reports__date-range-title">Даты отчёта</span>
                <div className="tt-reports__date-field">
                  <span className="tt-reports__date-field-label" id={`${filterRangeId}-from`}>
                    С
                  </span>
                  <DatePicker value={reportConfig.dateFrom} max={reportConfig.dateTo || undefined} onChange={(iso) => setCfg('dateFrom', iso)} aria-labelledby={`${filterRangeId}-from`} portal buttonClassName="tt-reports__date-picker-btn"/>
                </div>
                <div className="tt-reports__date-field">
                  <span className="tt-reports__date-field-label" id={`${filterRangeId}-to`}>
                    По
                  </span>
                  <DatePicker value={reportConfig.dateTo} min={reportConfig.dateFrom || undefined} onChange={(iso) => setCfg('dateTo', iso)} aria-labelledby={`${filterRangeId}-to`} portal buttonClassName="tt-reports__date-picker-btn"/>
                </div>
              </div>
            </div>

            <div className="rep-field">
              <label className="rep-label">Типы расходов</label>
              <ReportAllToggle id="types" label="Все типы" checked={allTypes} onToggle={next => {
            setAllTypes(next);
            if (next)
                setReportConfig(prev => ({ ...prev, selectedTypes: [] }));
        }}/>
              {!allTypes && (<div className="rep-check-grid rep-check-grid--wide">
                  {(!isPartner ? COMPANY_EXPENSE_TYPES : EXPENSE_TYPES.filter(t => t.value === 'partner_expense')).map(t => (<label key={t.value} className={`rep-check${reportConfig.selectedTypes.includes(t.value) ? ' rep-check--on' : ''}`}>
                      <input type="checkbox" checked={reportConfig.selectedTypes.includes(t.value)} onChange={() => toggleType(t.value)}/>
                      <span>{t.label}</span>
                    </label>))}
                </div>)}
            </div>

            <div className="rep-field">
              <label className="rep-label">Статусы</label>
              <ReportAllToggle id="statuses" label="Все статусы" checked={allStatuses} onToggle={next => {
            setAllStatuses(next);
            if (next)
                setReportConfig(prev => ({ ...prev, selectedStatuses: [] }));
        }}/>
              {!allStatuses && (<div className="rep-check-grid rep-check-grid--wide">
                  {STATUS_OPTIONS.map(s => (<label key={s.value} className={`rep-check${reportConfig.selectedStatuses.includes(s.value) ? ' rep-check--on' : ''}`}>
                      <input type="checkbox" checked={reportConfig.selectedStatuses.includes(s.value)} onChange={() => toggleStatus(s.value)}/>
                      <span className={`exp-status exp-status--${s.value}`}>{s.label}</span>
                    </label>))}
                </div>)}
            </div>

            <div className="rep-field">
              <label className="rep-label">Способ оплаты</label>
              <ReportAllToggle id="payments" label="Все способы" checked={allPayments} onToggle={next => {
            setAllPayments(next);
            if (next)
                setReportConfig(prev => ({ ...prev, selectedPaymentMethods: [] }));
        }}/>
              {!allPayments && (<div className="rep-check-grid rep-check-grid--wide">
                  {PAYMENT_METHODS.map(m => (<label key={m.value} className={`rep-check${reportConfig.selectedPaymentMethods.includes(m.value) ? ' rep-check--on' : ''}`}>
                      <input type="checkbox" checked={reportConfig.selectedPaymentMethods.includes(m.value)} onChange={() => togglePayment(m.value)}/>
                      <span>{m.label}</span>
                    </label>))}
                </div>)}
            </div>

            <div className="rep-field">
              <label className="rep-label">Возмещаемость</label>
              <div className="rep-radio-row rep-radio-row--wide">
                {([
            ['all', 'Все'],
            ['reimbursable', 'Возмещаемые'],
            ['non_reimbursable', 'Невозмещаемые'],
        ] as const).map(([val, lab]) => (<label key={val} className={`rep-radio${reportConfig.reimbursable === val ? ' rep-radio--on' : ''}`}>
                    <input type="radio" name="reimbursable" value={val} checked={reportConfig.reimbursable === val} onChange={() => setCfg('reimbursable', val)}/>
                    {lab}
                  </label>))}
              </div>
            </div>
          </div>
        </section>

        <section className="exp-report-panel exp-report-panel--excel" aria-labelledby="exp-report-excel-title">
          <h3 id="exp-report-excel-title" className="exp-report-panel__title">
            Выгрузка в Excel (.xlsx)
          </h3>
          <p className="exp-report-panel__hint">
            <strong>Полный отчёт</strong> — два листа: детальная таблица (все колонки, как в модальном окне на реестре) и
            сводка по типам / статусам / возмещаемости. <strong>Таблица с выбранными столбцами</strong> — один лист по
            настройкам таблицы ниже.
          </p>
          <div className="exp-report-excel-actions">
            <button type="button" className="exp-report-btn-excel exp-report-btn-excel--full" onClick={() => void handleExportFull()} disabled={loading || items.length === 0 || excelBusy !== 'idle'}>
              {excelBusy === 'full' ? 'Формируем…' : 'Скачать полный отчёт Excel'}
            </button>
            <button type="button" className="exp-report-btn-excel exp-report-btn-excel--custom" onClick={() => void handleExportCustom()} disabled={loading || filteredItems.length === 0 || visibleIds.length === 0 || excelBusy !== 'idle'}>
              {excelBusy === 'custom' ? 'Формируем…' : 'Скачать Excel: выбранные столбцы'}
            </button>
          </div>
          {excelError && (<p className="exp-report-excel-error" role="alert">
              {excelError}
            </p>)}
        </section>

        {!loading && filteredItems.length === 0 && !error && (<p className="exp-report-empty">Нет заявок, подходящих под текущие фильтры.</p>)}

        <section className="exp-report-section" aria-labelledby="exp-report-table-title">
          <div className="exp-report-section__head">
            <h2 id="exp-report-table-title" className="exp-report-section__title">
              Таблица и столбцы Excel
            </h2>
            <p className="exp-report-section__lead">
              Отметьте столбцы для превью и для кнопки «Скачать Excel: выбранные столбцы». Набор столбцов сохраняется в
              браузере. CSV и другие форматы отключены — только .xlsx.
            </p>
          </div>

          <div className="exp-report-columns">
            <button type="button" className="exp-report-columns__toggle" aria-expanded={columnsOpen} onClick={() => setColumnsOpen(o => !o)}>
              Столбцы ({visibleIds.length})
            </button>
            {columnsOpen && (<div className="exp-report-columns__grid">
                {EXPENSE_REPORT_COLUMNS.map(col => (<label key={col.id} className="exp-report-col-check">
                    <input type="checkbox" checked={visibleIds.includes(col.id)} onChange={() => toggleCol(col.id)}/>
                    <span>{col.label}</span>
                  </label>))}
              </div>)}
            <div className="exp-report-columns__actions">
              <button type="button" className="exp-report-btn-secondary" onClick={resetColumns}>
                Сбросить столбцы
              </button>
            </div>
          </div>

          <div className="exp-report-table-wrap">
            {loading ? (<p className="exp-report-table-placeholder">Загрузка…</p>) : filteredItems.length === 0 ? (<p className="exp-report-table-placeholder">Нет строк для отображения.</p>) : (<div className="exp-report-table-scroll">
                <table className="exp-report-table">
                  <thead>
                    <tr>
                      {visibleColumns.map(c => (<th key={c.id} style={{ minWidth: c.minWidth }}>
                          {c.label}
                        </th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(r => (<tr key={r.id}>
                        {visibleColumns.map(c => (<td key={c.id}>{c.value(r)}</td>))}
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
          </div>
        </section>
      </div>
    </ExpensesShell>);
}
