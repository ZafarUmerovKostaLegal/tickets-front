import { useState, useEffect, useId, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getUser, setUserInitials, type User, } from '@entities/user';
import { upsertTimeTrackingUser, getTimeTrackingUser, patchTimeTrackingUserWeeklyCapacity, patchTimeTrackingUserTransferWithoutProjectAccess, listHourlyRates, createHourlyRate, patchHourlyRate, deleteHourlyRate, changeHourlyRateFrom, getUserProjectAccess, putUserProjectAccess, listAllClientProjectsMerged, listAllTimeManagerClientsMerged, isForbiddenError, userFacingProjectAccessError, TIME_TRACKING_PROJECT_CURRENCIES, fetchAllTimeReportProjectRows, type HourlyRateRow, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { formatPeriodLabel, isoDateLocal, periodToDates } from '@entities/time-tracking/lib/reportsPeriodRange';
import { fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { writeReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import { PERIOD_OPTIONS, type PeriodGranularity } from '@entities/time-tracking/model/reportsPanelConfig';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';
import { isManualTtAuthUserId, isWithoutAuthRegistration, timeTrackingRowToUser } from '@entities/time-tracking/model/manualUsers';
import { useCurrentUser } from '@shared/hooks';
import { getUserEditUrl, routes } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { canManageUserProjectAccess } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { canManageHourlyRates } from '@entities/time-tracking/model/timeTrackingAccess';
import { isActiveTimeManagerProjectRow } from '@entities/time-tracking/lib/projectTimeEntry';
import '@pages/time-tracking/ui/TimePageShell.css';
import './UserEditPage.css';
type TabId = 'basic' | 'rates' | 'projects';
const TAB_IDS: TabId[] = ['basic', 'rates', 'projects'];
function tabFromSearchParam(raw: string | null): TabId {
    if (raw === 'basic' || raw === 'rates' || raw === 'projects')
        return raw;
    return 'basic';
}
function shiftPeriodDate(date: Date, granularity: PeriodGranularity, direction: -1 | 1): Date {
    const next = new Date(date);
    if (granularity === 'week')
        next.setDate(next.getDate() + 7 * direction);
    else if (granularity === 'month')
        next.setMonth(next.getMonth() + direction);
    else if (granularity === 'quarter')
        next.setMonth(next.getMonth() + 3 * direction);
    else if (granularity === 'year')
        next.setFullYear(next.getFullYear() + direction);
    return next;
}
type RateType = 'billable' | 'cost';
type Rate = {
    id: string;
    type: RateType;
    amount: number;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    projectId: string | null;
};
function hourlyRowToRate(row: HourlyRateRow): Rate {
    const type: RateType = row.rate_kind === 'cost' ? 'cost' : 'billable';
    const amt = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount));
    return {
        id: row.id,
        type,
        amount: Number.isFinite(amt) ? amt : 0,
        currency: row.currency,
        startDate: row.valid_from,
        endDate: row.valid_to,
        projectId: row.applies_to_project_id ?? row.project_id ?? null,
    };
}
type ProjectListItem = {
    id: string;
    name: string;
    client: string;
    color: string;
    archived: boolean;
};
const UEP_PROJECT_PICKER_CAP = 200;
function hashToColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 52% 40%)`;
}
function buildProjectCatalog(rows: TimeManagerClientProjectRow[], clientNameById: Map<string, string>): ProjectListItem[] {
    return rows.map((p) => ({
        id: p.id,
        name: p.name,
        client: clientNameById.get(p.client_id) ?? '',
        color: hashToColor(p.id),
        archived: !isActiveTimeManagerProjectRow(p),
    }));
}
function projectListSortKey(client: string): string {
    const trimmed = client.trim();
    return trimmed || '\uffff';
}
const CAPACITY_DEFAULT = 35;
const CAPACITY_OPTIONS = [20, 25, 30, 35, 40, 45, 50];
function capacityStateFromUser(u: User): {
    capacity: number;
    capCustom: boolean;
    capCustomVal: string;
} {
    const raw = u.weekly_capacity_hours;
    const n = raw != null && Number.isFinite(Number(raw))
        ? Number(raw)
        : CAPACITY_DEFAULT;
    const capCustom = !CAPACITY_OPTIONS.includes(n);
    return {
        capacity: n,
        capCustom,
        capCustomVal: capCustom ? String(n) : '',
    };
}
function getInitials(name: string | null | undefined, email?: string): string {
    const src = name ?? email ?? '';
    const parts = src.trim().split(/\s+/);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.charAt(0).toUpperCase() || '?';
}
function displayUserInitials(user: Pick<User, 'initials' | 'display_name' | 'email'>): string {
    const custom = (user.initials ?? '').trim().toUpperCase();
    if (custom.length >= 3 && custom.length <= 8)
        return custom;
    return getInitials(user.display_name, user.email);
}
function normalizeInitialsInput(raw: string): string {
    return raw
        .toUpperCase()
        .replace(/Ё/g, 'Е')
        .replace(/[^A-ZА-Я]/g, '')
        .slice(0, 8);
}
function splitName(displayName: string | null): {
    first: string;
    last: string;
} {
    if (!displayName)
        return { first: '', last: '' };
    const parts = displayName.trim().split(/\s+/);
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}
function fmtDate(d: string | null): string {
    if (!d)
        return '';
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
type RateSaveData = Omit<Rate, 'id'> & {
    autoClosePrevRateId?: string;
    autoClosePrevValidTo?: string;
};
type RateProjectOption = {
    id: string;
    name: string;
    client: string;
    color: string;
    archived: boolean;
};
const RATE_PROJECT_PICKER_CAP = 200;
function rateProjectDisplayName(opt: Pick<RateProjectOption, 'name' | 'archived'>): string {
    return opt.archived ? `${opt.name} (архив)` : opt.name;
}
function rateProjectOptionLabel(opt: Pick<RateProjectOption, 'name' | 'client' | 'archived'>): string {
    const client = opt.client.trim();
    const name = rateProjectDisplayName(opt);
    return client ? `${name} · ${client}` : name;
}
type RateProjectLevelPickerProps = {
    inputId: string;
    value: string;
    options: RateProjectOption[];
    disabled?: boolean;
    onChange: (projectId: string) => void;
};
function RateProjectLevelPicker({ inputId, value, options, disabled, onChange }: RateProjectLevelPickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const selected = value ? options.find((o) => o.id === value) : null;
    const selectedLabel = selected
        ? rateProjectOptionLabel(selected)
        : 'Общая (во всех проектах)';
    const q = query.trim().toLowerCase();
    const filtered = q
        ? options.filter((o) => o.name.toLowerCase().includes(q) || o.client.toLowerCase().includes(q))
        : options;
    const displayResults = q ? filtered : filtered.slice(0, RATE_PROJECT_PICKER_CAP);
    const listTruncated = !q && options.length > RATE_PROJECT_PICKER_CAP;
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    const pick = (projectId: string) => {
        onChange(projectId);
        setQuery('');
        setOpen(false);
    };
    if (disabled) {
        return (<input id={inputId} className="uep__input" value={selectedLabel} disabled readOnly/>);
    }
    return (<div className="uep__rate-proj-pick" ref={wrapRef}>
      <button
        id={inputId}
        type="button"
        className={`uep__rate-proj-pick-trigger${open ? ' uep__rate-proj-pick-trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="uep__rate-proj-pick-value">{selectedLabel}</span>
        <svg className="uep__rate-proj-pick-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && createPortal((() => {
            const rect = wrapRef.current?.getBoundingClientRect();
            if (!rect)
                return null;
            return (<div
                id={listId}
                role="listbox"
                aria-label="Проекты для ставки"
                className="uep__rate-proj-pick-drop"
                style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
            >
              <div className="uep__rate-proj-pick-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="search"
                  value={query}
                  placeholder="Поиск по проекту или клиенту"
                  autoFocus
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            setOpen(false);
                        }
                    }}
                />
                {query && (<button type="button" aria-label="Очистить" onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery('');
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>)}
              </div>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`uep__proj-dropdown-item uep__rate-proj-pick-option${!value ? ' uep__rate-proj-pick-option--active' : ''}`}
                onMouseDown={() => pick('')}
              >
                <span className="uep__proj-dd-body">
                  <span className="uep__proj-dd-name">Общая (во всех проектах)</span>
                  <span className="uep__proj-dd-client">Без привязки к проекту</span>
                </span>
              </button>
              {displayResults.length === 0
                ? (<p className="uep__proj-dropdown-empty">Ничего не найдено — измените запрос</p>)
                : displayResults.map((p) => (<button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={value === p.id}
                      className={`uep__proj-dropdown-item uep__rate-proj-pick-option${value === p.id ? ' uep__rate-proj-pick-option--active' : ''}`}
                      onMouseDown={() => pick(p.id)}
                    >
                      <span className="uep__proj-dd-dot" style={{ background: p.color }}/>
                      <span className="uep__proj-dd-body">
                        <span className="uep__proj-dd-name">{rateProjectDisplayName(p)}</span>
                        {p.client
                ? <span className="uep__proj-dd-client">{p.client}</span>
                : p.archived
                    ? <span className="uep__proj-dd-client">Архивный проект</span>
                    : null}
                      </span>
                    </button>))}
              {listTruncated && (<p className="uep__proj-drop-hint" role="note">
                  Показаны первые {RATE_PROJECT_PICKER_CAP} из {options.length}. Уточните поиск по названию или клиенту.
                </p>)}
            </div>);
        })(), document.body)}
    </div>);
}
type RateFormProps = {
    rate?: Rate;
    type: RateType;
    existingRates: Rate[];
    projects: RateProjectOption[];
    onSave: (r: RateSaveData) => void | Promise<void>;
    onClose: () => void;
};
function isoDateMinusOneDay(iso: string): string | null {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime()))
        return null;
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}
function ratePeriodsOverlap(aFrom: string | null, aTo: string | null, bFrom: string | null, bTo: string | null): boolean {
    const af = aFrom ?? '0000-01-01';
    const at = aTo ?? '9999-12-31';
    const bf = bFrom ?? '0000-01-01';
    const bt = bTo ?? '9999-12-31';
    return af <= bt && bf <= at;
}
function RateFormModal({ rate, type, existingRates, projects, onSave, onClose }: RateFormProps) {
    const [amount, setAmount] = useState(rate ? String(rate.amount) : '');
    const [currency, setCurrency] = useState(rate?.currency ?? 'USD');
    const [startDate, setStartDate] = useState(rate?.startDate ?? '');
    const [endDate, setEndDate] = useState(rate?.endDate ?? '');
    const [projectId, setProjectId] = useState<string>(rate?.projectId ?? '');
    const [autoClosePrev, setAutoClosePrev] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const uid = useId();
    const levelId = projectId || null;
    const sameScopeRates = useMemo(() => existingRates.filter((r) => r.currency === currency && (r.projectId ?? null) === levelId), [existingRates, currency, levelId]);
    const autoCloseCandidate = useMemo(() => {
        if (rate || !startDate)
            return null;
        const closeTo = isoDateMinusOneDay(startDate);
        if (!closeTo)
            return null;
        const open = sameScopeRates
            .filter((r) => (r.startDate ?? '0000-01-01') < startDate && (r.endDate == null || r.endDate >= startDate))
            .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
        const prev = open[open.length - 1];
        return prev ? { rate: prev, closeTo } : null;
    }, [rate, startDate, sameScopeRates]);
    const overlapWarning = useMemo(() => {
        const conflict = sameScopeRates.find((r) => {
            if (autoClosePrev && autoCloseCandidate && r.id === autoCloseCandidate.rate.id)
                return false;
            return ratePeriodsOverlap(startDate || null, endDate || null, r.startDate, r.endDate);
        });
        return conflict ?? null;
    }, [sameScopeRates, startDate, endDate, autoClosePrev, autoCloseCandidate]);
    const handleSubmit = async () => {
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) {
            setError('Введите корректную сумму');
            return;
        }
        if (startDate && endDate && startDate > endDate) {
            setError('Дата начала позже даты окончания');
            return;
        }
        if (overlapWarning) {
            setError('Период пересекается с другой ставкой того же типа и валюты. Скорректируйте даты или включите авто-закрытие предыдущей ставки.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const payload: RateSaveData = { type, amount: amt, currency, startDate: startDate || null, endDate: endDate || null, projectId: levelId };
            if (autoClosePrev && autoCloseCandidate) {
                payload.autoClosePrevRateId = autoCloseCandidate.rate.id;
                payload.autoClosePrevValidTo = autoCloseCandidate.closeTo;
            }
            await Promise.resolve(onSave(payload));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="uep__modal-overlay">
      <div className="uep__modal" onClick={(e) => e.stopPropagation()}>
        <div className="uep__modal-head">
          <h3 className="uep__modal-title">
            {rate ? 'Редактировать ставку' : `Новая ${type === 'billable' ? 'оплачиваемая' : 'себестоимость'} ставка`}
          </h3>
          <button type="button" className="uep__modal-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="uep__modal-body">
          <div className="uep__field">
            <label className="uep__label" htmlFor={`${uid}-level`}>Уровень ставки</label>
            <RateProjectLevelPicker
              inputId={`${uid}-level`}
              value={projectId}
              options={projects}
              disabled={!!rate}
              onChange={setProjectId}
            />
            <p className="uep__hint">
              {rate
            ? 'Уровень нельзя изменить: удалите ставку и создайте заново, чтобы перенести между проектами.'
            : 'Проектная ставка действует только в выбранном проекте и имеет приоритет над общей.'}
            </p>
          </div>
          <div className="uep__field">
            <label className="uep__label" htmlFor={`${uid}-amount`}>Ставка в час</label>
            <div className="uep__rate-amount-row">
              <input id={`${uid}-amount`} type="number" min="0" step="0.01" className="uep__input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}/>
              <select className="uep__select uep__select--currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {TIME_TRACKING_PROJECT_CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            {error && <p className="uep__field-error">{error}</p>}
          </div>
          <div className="uep__field-row">
            <div className="uep__field">
              <label className="uep__label" htmlFor={`${uid}-start`}>Дата начала</label>
              <input id={`${uid}-start`} type="date" className="uep__input" value={startDate} onChange={(e) => setStartDate(e.target.value)}/>
              <p className="uep__hint">Пусто — «с начала времён»</p>
            </div>
            <div className="uep__field">
              <label className="uep__label" htmlFor={`${uid}-end`}>Дата окончания</label>
              <input id={`${uid}-end`} type="date" className="uep__input" value={endDate} onChange={(e) => setEndDate(e.target.value)}/>
              <p className="uep__hint">Пусто — «без ограничений»</p>
            </div>
          </div>
          {autoCloseCandidate && (<label className="uep__rate-autoclose">
            <input type="checkbox" checked={autoClosePrev} onChange={(e) => setAutoClosePrev(e.target.checked)}/>
            <span>
              Закрыть предыдущую ставку ({autoCloseCandidate.rate.amount} {autoCloseCandidate.rate.currency}) датой {fmtDate(autoCloseCandidate.closeTo)}
            </span>
          </label>)}
          {overlapWarning && (<p className="uep__field-error" role="alert">
            Период пересекается со ставкой {overlapWarning.amount} {overlapWarning.currency}
            {' '}({overlapWarning.startDate ? fmtDate(overlapWarning.startDate) : '—'} – {overlapWarning.endDate ? fmtDate(overlapWarning.endDate) : 'по наст. время'}).
          </p>)}
        </div>
        <div className="uep__modal-foot">
          <button type="button" className="uep__btn uep__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Сохранение…' : rate ? 'Сохранить' : 'Добавить'}
          </button>
          <button type="button" className="uep__btn uep__btn--ghost" disabled={saving} onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>);
}
type RateChangeFromData = {
    effectiveFrom: string;
    amount: number;
    currency: string;
};
type RateChangeFromProps = {
    type: RateType;
    projectLabel: string | null;
    currency: string;
    currentAmount: number | null;
    onSave: (d: RateChangeFromData) => void | Promise<void>;
    onClose: () => void;
};
function RateChangeFromModal({ type, projectLabel, currency, currentAmount, onSave, onClose }: RateChangeFromProps) {
    const [effectiveFrom, setEffectiveFrom] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const uid = useId();
    const previewBefore = effectiveFrom ? isoDateMinusOneDay(effectiveFrom) : null;
    const amtNum = parseFloat(amount);
    const handleSubmit = async () => {
        if (!effectiveFrom) {
            setError('Укажите дату начала действия новой ставки');
            return;
        }
        if (!amount || isNaN(amtNum) || amtNum <= 0) {
            setError('Введите корректную сумму (> 0)');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await Promise.resolve(onSave({ effectiveFrom, amount: amtNum, currency }));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сменить ставку');
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="uep__modal-overlay">
      <div className="uep__modal" onClick={(e) => e.stopPropagation()}>
        <div className="uep__modal-head">
          <h3 className="uep__modal-title">
            Сменить {type === 'billable' ? 'оплачиваемую' : 'себестоимость'} ставку с даты
          </h3>
          <button type="button" className="uep__modal-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="uep__modal-body">
          <div className="uep__field">
            <label className="uep__label">Уровень ставки</label>
            <input className="uep__input" value={projectLabel ?? 'Общая (во всех проектах)'} disabled readOnly/>
            <p className="uep__hint">
              {projectLabel
                ? 'Новая ставка применится только в этом проекте, начиная с выбранного дня.'
                : 'Новая общая ставка применится во всех проектах без собственной проектной ставки на эту дату.'}
            </p>
          </div>
          <div className="uep__field-row">
            <div className="uep__field">
              <label className="uep__label" htmlFor={`${uid}-eff`}>Действует с даты</label>
              <input id={`${uid}-eff`} type="date" className="uep__input" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}/>
            </div>
            <div className="uep__field">
              <label className="uep__label" htmlFor={`${uid}-amt`}>Новая ставка в час</label>
              <div className="uep__rate-amount-row">
                <input id={`${uid}-amt`} type="number" min="0" step="0.01" className="uep__input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}/>
                <input className="uep__select uep__select--currency" value={currency} disabled readOnly aria-label="Валюта"/>
              </div>
            </div>
          </div>
          {effectiveFrom && !isNaN(amtNum) && amtNum > 0 && (<p className="uep__hint" role="status">
            {previewBefore
            ? `До ${fmtDate(previewBefore)} — ${currentAmount != null ? `${currentAmount.toFixed(2)} ${currency}` : 'старая ставка'}, с ${fmtDate(effectiveFrom)} — ${amtNum.toFixed(2)} ${currency}.`
            : `С ${fmtDate(effectiveFrom)} — ${amtNum.toFixed(2)} ${currency}.`}
          </p>)}
          {error && <p className="uep__field-error" role="alert">{error}</p>}
        </div>
        <div className="uep__modal-foot">
          <button type="button" className="uep__btn uep__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Сохранение…' : 'Сменить ставку'}
          </button>
          <button type="button" className="uep__btn uep__btn--ghost" disabled={saving} onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>);
}
export function UserEditPage() {
    const { id } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentEditor } = useCurrentUser();
    const canEditTTProjectAccess = canManageUserProjectAccess(currentEditor?.role, currentEditor?.time_tracking_role ?? null);
    const canChangeCostRateFromDate = canAccessAdminPanel(currentEditor?.role, currentEditor?.position);
    const canChangeBillableRateFromDate = canChangeCostRateFromDate || canManageHourlyRates(currentEditor);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const activeTab = tabFromSearchParam(searchParams.get('tab'));
    const selectTab = (tab: TabId) => {
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            if (tab === 'basic')
                p.delete('tab');
            else
                p.set('tab', tab);
            return p;
        }, { replace: true });
    };
    const [rates, setRates] = useState<Rate[]>([]);
    const [rateModal, setRateModal] = useState<{
        type: RateType;
        rate?: Rate;
    } | null>(null);
    const [rateChangeFromModal, setRateChangeFromModal] = useState<{
        type: RateType;
        projectId: string | null;
        projectLabel: string | null;
        currency: string;
        currentAmount: number | null;
        sourceRateId: string;
    } | null>(null);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState<string | null>(null);
    const [costRatesForbidden, setCostRatesForbidden] = useState(false);
    const [projectCatalog, setProjectCatalog] = useState<ProjectListItem[]>([]);
    const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
    const [projectsTabLoading, setProjectsTabLoading] = useState(false);
    const [projectsTabError, setProjectsTabError] = useState<string | null>(null);
    const [projectsTabSaving, setProjectsTabSaving] = useState(false);
    const [transferWithoutProjectAccess, setTransferWithoutProjectAccess] = useState(false);
    const [transferFlagSaving, setTransferFlagSaving] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [assignedProjectsStatus, setAssignedProjectsStatus] = useState<'active' | 'archived' | 'all'>('active');
    const [projPeriodDate, setProjPeriodDate] = useState(() => new Date());
    const [projPeriodGranularity, setProjPeriodGranularity] = useState<PeriodGranularity>('month');
    const [projPeriodDropdown, setProjPeriodDropdown] = useState(false);
    const [projectHoursById, setProjectHoursById] = useState<Record<string, number>>({});
    const [projectActivityLoading, setProjectActivityLoading] = useState(false);
    const [projectActivityError, setProjectActivityError] = useState<string | null>(null);
    const projPeriodDropdownRef = useRef<HTMLDivElement>(null);
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const projPickListId = useId();
    const [capacity, setCapacity] = useState<number>(CAPACITY_DEFAULT);
    const [capCustom, setCapCustom] = useState(false);
    const [capCustomVal, setCapCustomVal] = useState('');
    const [capSaved, setCapSaved] = useState(false);
    const [capSaving, setCapSaving] = useState(false);
    const [capError, setCapError] = useState<string | null>(null);
    const [initialsInput, setInitialsInput] = useState('');
    const [initialsSaving, setInitialsSaving] = useState(false);
    const [initialsSaved, setInitialsSaved] = useState(false);
    const [initialsError, setInitialsError] = useState<string | null>(null);
    const [isManualUser, setIsManualUser] = useState(false);
    useEffect(() => {
        if (!id)
            return;
        const authId = Number(id);
        if (!Number.isFinite(authId))
            return;
        setLoading(true);
        setFetchError(null);
        const applyUser = (u: User, manual: boolean) => {
            setUser(u);
            setIsManualUser(manual);
            setRates([]);
            setRatesError(null);
            setCostRatesForbidden(false);
            setAssignedProjectIds([]);
            setProjectCatalog([]);
            setProjectsTabError(null);
            setTransferWithoutProjectAccess(false);
            const capSt = capacityStateFromUser(u);
            setCapacity(capSt.capacity);
            setCapCustom(capSt.capCustom);
            setCapCustomVal(capSt.capCustomVal);
            setCapError(null);
            setInitialsInput((u.initials ?? '').trim().toUpperCase());
            setInitialsError(null);
        };
        const loadFromTt = () => getTimeTrackingUser(authId)
            .then((row) => applyUser(timeTrackingRowToUser(row), isWithoutAuthRegistration(row)))
            .catch((e: unknown) => setFetchError((e as Error).message ?? 'Ошибка загрузки'));
        if (isManualTtAuthUserId(authId)) {
            void loadFromTt().finally(() => setLoading(false));
            return;
        }
        getUser(authId)
            .then((u) => applyUser(u, false))
            .catch(() => loadFromTt())
            .finally(() => setLoading(false));
    }, [id]);
    useEffect(() => {
        const raw = searchParams.get('tab');
        if (raw != null && !TAB_IDS.includes(raw as TabId)) {
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                p.delete('tab');
                return p;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);
    const refreshRates = useCallback(async () => {
        if (!user)
            return;
        setRatesLoading(true);
        setRatesError(null);
        try {
            if (!isManualUser)
                await upsertTimeTrackingUser(user);
            const billableRows = await listHourlyRates(user.id, 'billable');
            let costRows: HourlyRateRow[] = [];
            let costForbidden = false;
            try {
                costRows = await listHourlyRates(user.id, 'cost');
            }
            catch (e) {
                if (isForbiddenError(e))
                    costForbidden = true;
                else
                    throw e;
            }
            setCostRatesForbidden(costForbidden);
            setRates([...billableRows.map(hourlyRowToRate), ...costRows.map(hourlyRowToRate)]);
        }
        catch (e) {
            setRates([]);
            setRatesError(e instanceof Error ? e.message : 'Не удалось загрузить ставки');
        }
        finally {
            setRatesLoading(false);
        }
    }, [user, isManualUser]);
    const persistCapacityHours = useCallback(async (hours: number) => {
        if (!user)
            return;
        if (hours <= 0 || hours > 168)
            return;
        setCapError(null);
        setCapSaving(true);
        try {
            if (isManualUser) {
                const row = await patchTimeTrackingUserWeeklyCapacity(user.id, hours);
                setUser(timeTrackingRowToUser(row));
            }
            else {
                await upsertTimeTrackingUser(user, { weeklyCapacityHours: hours });
                setUser((prev) => (prev ? { ...prev, weekly_capacity_hours: hours } : null));
            }
            setCapSaved(true);
            setTimeout(() => setCapSaved(false), 2000);
        }
        catch (e) {
            setCapError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setCapSaving(false);
        }
    }, [user, isManualUser]);
    const persistInitials = useCallback(async () => {
        if (!user || isManualUser)
            return;
        const normalized = normalizeInitialsInput(initialsInput);
        const current = (user.initials ?? '').trim().toUpperCase();
        if (normalized === current)
            return;
        if (normalized.length > 0 && (normalized.length < 3 || normalized.length > 8)) {
            setInitialsError('Введите от 3 до 8 букв или оставьте поле пустым');
            return;
        }
        setInitialsError(null);
        setInitialsSaving(true);
        try {
            const updated = await setUserInitials(user.id, normalized || null);
            setUser(updated);
            setInitialsInput((updated.initials ?? '').trim().toUpperCase());
            setInitialsSaved(true);
            setTimeout(() => setInitialsSaved(false), 2000);
        }
        catch (e) {
            setInitialsError(e instanceof Error ? e.message : 'Не удалось сохранить инициалы');
        }
        finally {
            setInitialsSaving(false);
        }
    }, [user, isManualUser, initialsInput]);
    useEffect(() => {
        if (!user || activeTab !== 'rates')
            return;
        void refreshRates();
    }, [user, activeTab, refreshRates]);
    useEffect(() => {
        if (!user || (activeTab !== 'projects' && activeTab !== 'rates'))
            return;
        let cancelled = false;
        setProjectsTabLoading(true);
        setProjectsTabError(null);
        (async () => {
            try {
                if (!isManualUser)
                    await upsertTimeTrackingUser(user);
                const [clients, access, catalogRows, ttUser] = await Promise.all([
                    listAllTimeManagerClientsMerged(),
                    getUserProjectAccess(user.id),
                    listAllClientProjectsMerged(true),
                    getTimeTrackingUser(user.id).catch(() => null),
                ]);
                if (cancelled)
                    return;
                const nameById = new Map(clients.map((c) => [c.id, c.name]));
                setProjectCatalog(buildProjectCatalog(catalogRows, nameById));
                setAssignedProjectIds(access.projectIds);
                setTransferWithoutProjectAccess(ttUser?.can_transfer_time_without_project_access === true);
            }
            catch (e) {
                if (!cancelled) {
                    setProjectsTabError(e instanceof Error ? e.message : 'Не удалось загрузить проекты и доступ');
                    setProjectCatalog([]);
                    setAssignedProjectIds([]);
                }
            }
            finally {
                if (!cancelled)
                    setProjectsTabLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user, activeTab, isManualUser]);

    const projPeriodRange = useMemo(
        () => periodToDates(projPeriodDate, projPeriodGranularity),
        [projPeriodDate, projPeriodGranularity],
    );
    const projPeriodTitle = useMemo(() => {
        if (projPeriodGranularity === 'all')
            return 'За всё время';
        return formatPeriodLabel(projPeriodDate, projPeriodGranularity);
    }, [projPeriodDate, projPeriodGranularity]);

    useEffect(() => {
        if (!user || activeTab !== 'projects')
            return;
        let cancelled = false;
        setProjectActivityLoading(true);
        setProjectActivityError(null);
        fetchAllTimeReportProjectRows({
            dateFrom: projPeriodRange.dateFrom,
            dateTo: projPeriodRange.dateTo,
            user_id: String(user.id),
        })
            .then((rows) => {
                if (cancelled)
                    return;
                const next: Record<string, number> = {};
                for (const row of rows) {
                    const pid = String(row.project_id ?? '').trim();
                    if (!pid)
                        continue;
                    const hours = Number(row.total_hours);
                    if (!Number.isFinite(hours) || hours <= 0)
                        continue;
                    next[pid] = (next[pid] ?? 0) + hours;
                }
                setProjectHoursById(next);
            })
            .catch((e: unknown) => {
                if (cancelled)
                    return;
                setProjectHoursById({});
                setProjectActivityError(e instanceof Error ? e.message : 'Не удалось загрузить активность по проектам');
            })
            .finally(() => {
                if (!cancelled)
                    setProjectActivityLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [user, activeTab, projPeriodRange.dateFrom, projPeriodRange.dateTo]);

    useEffect(() => {
        if (!projPeriodDropdown)
            return;
        const onDoc = (e: MouseEvent) => {
            if (projPeriodDropdownRef.current && !projPeriodDropdownRef.current.contains(e.target as Node))
                setProjPeriodDropdown(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [projPeriodDropdown]);

    const openProjectReportPreview = useCallback((projectId: string) => {
        if (!user)
            return;
        const trimmed = projectId.trim();
        if (!trimmed)
            return;
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'time',
            groupBy: 'projects',
            filters: {
                dateFrom: projPeriodRange.dateFrom,
                dateTo: projPeriodRange.dateTo,
                user_id: String(user.id),
                project_id: trimmed,
                page: 1,
                per_page: 500,
            },
            period: {
                periodGranularity: projPeriodGranularity,
                periodAnchorIso: isoDateLocal(projPeriodDate),
                customRangeActive: false,
            },
            returnTo: `${getUserEditUrl(user.id)}?tab=projects`,
        });
        navigate(routes.timeTrackingReportPreview);
    }, [user, projPeriodRange.dateFrom, projPeriodRange.dateTo, projPeriodGranularity, projPeriodDate, navigate]);

    async function persistTransferWithoutProjectAccess(enabled: boolean) {
        if (!user || !canEditTTProjectAccess)
            return;
        setTransferFlagSaving(true);
        setProjectsTabError(null);
        const prev = transferWithoutProjectAccess;
        setTransferWithoutProjectAccess(enabled);
        try {
            await patchTimeTrackingUserTransferWithoutProjectAccess(user.id, enabled);
        }
        catch (e) {
            setTransferWithoutProjectAccess(prev);
            setProjectsTabError(e instanceof Error ? e.message : 'Не удалось сохранить право на перенос');
        }
        finally {
            setTransferFlagSaving(false);
        }
    }
    async function persistProjectAccess(nextIds: string[]) {
        if (!user || !canEditTTProjectAccess)
            return;
        setProjectsTabSaving(true);
        setProjectsTabError(null);
        try {
            await putUserProjectAccess(user.id, nextIds);
            setAssignedProjectIds(nextIds);
        }
        catch (e) {
            const raw = e instanceof Error ? e.message : 'Не удалось сохранить доступ';
            setProjectsTabError(userFacingProjectAccessError(raw));
            try {
                const a = await getUserProjectAccess(user.id);
                setAssignedProjectIds(a.projectIds);
            }
            catch {
            }
        }
        finally {
            setProjectsTabSaving(false);
        }
    }
    async function handleCapacityChange(val: string) {
        if (val === '__custom__') {
            setCapCustom(true);
            setCapCustomVal('');
            return;
        }
        setCapCustom(false);
        const n = parseInt(val, 10);
        if (isNaN(n) || n <= 0 || n > 168)
            return;
        setCapacity(n);
        await persistCapacityHours(n);
    }
    async function handleCapCustomSave() {
        const n = parseInt(capCustomVal, 10);
        if (isNaN(n) || n <= 0 || n > 168)
            return;
        setCapacity(n);
        await persistCapacityHours(n);
    }
    const handleSaveRate = async (data: RateSaveData) => {
        if (!user)
            return;
        const rateKind = data.type === 'cost' ? 'cost' : 'billable';
        if (data.autoClosePrevRateId && data.autoClosePrevValidTo) {
            await patchHourlyRate(user.id, data.autoClosePrevRateId, {
                validTo: data.autoClosePrevValidTo,
            });
        }
        const editing = rateModal?.rate;
        const newStart = data.startDate?.trim() || null;
        const oldStart = editing?.startDate?.trim() || null;
        const amountChanged = editing != null && data.amount !== editing.amount;
        const startChanged = editing != null && newStart !== oldStart;
        if (editing && newStart && (amountChanged || startChanged)) {
            await changeHourlyRateFrom(user.id, {
                rateKind,
                appliesToProjectId: editing.projectId,
                effectiveFrom: newStart,
                amount: data.amount,
                currency: data.currency,
                sourceRateId: editing.id,
            });
            setRateModal(null);
            await refreshRates();
            return;
        }
        if (editing) {
            await patchHourlyRate(user.id, editing.id, {
                amount: String(data.amount),
                currency: data.currency,
                validFrom: newStart,
                validTo: data.endDate?.trim() || null,
            });
        }
        else {
            await createHourlyRate(user.id, {
                rateKind,
                amount: String(data.amount),
                currency: data.currency,
                validFrom: newStart,
                validTo: data.endDate?.trim() || null,
                appliesToProjectId: data.projectId,
            });
        }
        setRateModal(null);
        await refreshRates();
    };
    const handleDeleteRate = async (rateId: string) => {
        if (!user)
            return;
        setRatesError(null);
        try {
            await deleteHourlyRate(user.id, rateId);
            await refreshRates();
        }
        catch (e) {
            setRatesError(e instanceof Error ? e.message : 'Не удалось удалить ставку');
        }
    };
    const handleChangeRateFrom = async (data: RateChangeFromData) => {
        if (!user || !rateChangeFromModal)
            return;
        await changeHourlyRateFrom(user.id, {
            rateKind: rateChangeFromModal.type,
            appliesToProjectId: rateChangeFromModal.projectId,
            effectiveFrom: data.effectiveFrom,
            amount: data.amount,
            currency: data.currency,
            sourceRateId: rateChangeFromModal.sourceRateId,
        });
        setRateChangeFromModal(null);
        await refreshRates();
    };
    const assignProject = (projId: string) => {
        if (!user || !canEditTTProjectAccess || assignedProjectIds.includes(projId))
            return;
        void persistProjectAccess([...assignedProjectIds, projId]);
        setProjectSearch('');
        setSearchOpen(false);
    };
    const removeProject = (projId: string) => {
        if (!user || !canEditTTProjectAccess)
            return;
        void persistProjectAccess(assignedProjectIds.filter((x) => x !== projId));
    };
    const clearAllProjects = () => {
        if (!user || !canEditTTProjectAccess)
            return;
        void persistProjectAccess([]);
    };
    const projectById = useMemo(() => new Map(projectCatalog.map((p) => [p.id, p])), [projectCatalog]);
    const rateProjectLabel = useCallback((r: Rate): string => {
        if (!r.projectId)
            return 'Общая';
        const p = projectById.get(r.projectId);
        if (!p)
            return `Проект ${r.projectId}`;
        return rateProjectOptionLabel(p);
    }, [projectById]);
    const sortRatesForDisplay = useCallback((list: Rate[]): Rate[] => {
        return [...list].sort((a, b) => {
            if (!a.projectId && b.projectId)
                return -1;
            if (a.projectId && !b.projectId)
                return 1;
            const an = a.projectId ? rateProjectLabel(a) : '';
            const bn = b.projectId ? rateProjectLabel(b) : '';
            const c = an.localeCompare(bn, 'ru', { sensitivity: 'base' });
            if (c !== 0)
                return c;
            return (a.startDate ?? '').localeCompare(b.startDate ?? '');
        });
    }, [rateProjectLabel]);
    const billableRates = useMemo(() => sortRatesForDisplay(rates.filter((r) => r.type === 'billable')), [rates, sortRatesForDisplay]);
    const costRates = useMemo(() => sortRatesForDisplay(rates.filter((r) => r.type === 'cost')), [rates, sortRatesForDisplay]);
    const rateProjectOptions = useMemo<RateProjectOption[]>(() => {
        const seen = new Set<string>();
        const out: RateProjectOption[] = [];
        for (const p of projectCatalog) {
            seen.add(p.id);
            out.push({
                id: p.id,
                name: p.name,
                client: p.client,
                color: p.color,
                archived: p.archived,
            });
        }
        const extraIds = [
            ...assignedProjectIds,
            ...rates.map((r) => r.projectId).filter((pid): pid is string => Boolean(pid)),
        ];
        for (const pid of extraIds) {
            if (seen.has(pid))
                continue;
            seen.add(pid);
            out.push({
                id: pid,
                name: 'Неизвестный проект',
                client: 'Не найден в каталоге',
                color: hashToColor(pid),
                archived: false,
            });
        }
        out.sort((a, b) => {
            if (a.archived !== b.archived)
                return a.archived ? 1 : -1;
            const byClient = projectListSortKey(a.client).localeCompare(projectListSortKey(b.client), 'ru', { sensitivity: 'base' });
            if (byClient !== 0)
                return byClient;
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });
        return out;
    }, [projectCatalog, assignedProjectIds, rates]);
    if (loading) {
        return (<div className="time-page time-page--enter uep" aria-busy="true" aria-live="polite">
        <main className="time-page__main">
          <div className="time-page__navbar" aria-hidden>
            <span className="uep__skel uep__skel--back"/>
            <div className="time-page__navbar-sep"/>
            <div className="time-page__navbar-tabs time-page__navbar-tabs--skel" style={{ height: 56, alignItems: 'center' }}>
              {[64, 52, 58].map((w, i) => (<span key={i} className="time-page__navbar-tab-skel" style={{ width: w }}/>))}
            </div>
            <div className="time-page__navbar-spacer"/>
            <span className="uep__skel" style={{ width: 72, height: 28, borderRadius: 20 }}/>
            <div className="time-page__navbar-settings">
              <span className="uep__skel" style={{ width: 32, height: 32, borderRadius: 8 }}/>
            </div>
          </div>
          <div className="time-page__content">
            <div className="uep-profile uep-profile--skel">
              <div className="uep-profile__hero uep-profile__hero--skel">
                <div className="uep-profile__identity">
                  <div className="uep__skel uep__skel--avatar" style={{ width: 56, height: 56 }}/>
                  <div>
                    <span className="uep__skel uep__skel--line" style={{ maxWidth: 200 }}/>
                    <span className="uep__skel uep__skel--line uep__skel--md" style={{ marginTop: 8, maxWidth: 240 }}/>
                  </div>
                </div>
                <div className="uep-profile__meta uep-profile__meta--skel">
                  <span className="uep__skel" style={{ width: 80, height: 12 }}/>
                  <span className="uep__skel" style={{ width: 100, height: 12 }}/>
                </div>
              </div>
              <div className="uep__section" style={{ marginTop: 8 }}>
                <div className="uep__section-head">
                  <span className="uep__skel uep__skel--icon"/>
                  <div>
                    <span className="uep__skel uep__skel--title"/>
                    <span className="uep__skel uep__skel--desc" style={{ display: 'block', marginTop: 8 }}/>
                  </div>
                </div>
                <div className="uep__form">
                  <span className="uep__skel uep__skel--field"/>
                  <span className="uep__skel uep__skel--field"/>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>);
    }
    if (fetchError || !user) {
        return (<div className="time-page time-page--enter uep">
        <main className="time-page__main">
          <div className="uep__fetch-error" style={{ flex: 1, minHeight: '50vh' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>{fetchError ?? 'Пользователь не найден'}</p>
            <AppBackButton historyBack />
          </div>
        </main>
      </div>);
    }
    const { first, last } = splitName(user.display_name);
    const initials = displayUserInitials(user);
    const statusKey = user.is_archived ? 'archived' : user.is_blocked ? 'blocked' : 'active';
    const statusLabel = user.is_archived ? 'В архиве' : user.is_blocked ? 'Заблокирован' : 'Активен';
    const TABS: {
        id: TabId;
        label: string;
        icon: React.ReactNode;
    }[] = [
        {
            id: 'basic', label: 'Основная информация',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
        },
        {
            id: 'rates', label: 'Ставки',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
        },
        {
            id: 'projects', label: 'Проекты',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><path d="M8 7V5a2 2 0 0 0-4 0v2"/></svg>,
        },
    ];
    return (<div className="time-page time-page--enter uep">
    <main className="time-page__main">
        <nav className="time-page__navbar" aria-label="Профиль сотрудника">
          <AppBackButton historyBack hideLabelOnMobile />
          <AppHomeLogo withSeparator />
          <div className="time-page__navbar-sep" aria-hidden/>
          <span className="time-page__navbar-title">Профиль</span>
          <div className="time-page__navbar-sep" aria-hidden/>
          <div className="time-page__navbar-tabs" role="tablist" aria-label="Разделы карточки">
            {TABS.map((t) => (<button key={t.id} type="button" role="tab" id={`uep-tab-${t.id}`} aria-selected={activeTab === t.id} aria-controls={`uep-panel-${t.id}`} className={`time-page__navbar-tab${activeTab === t.id ? ' time-page__navbar-tab--active' : ''}`} onClick={() => selectTab(t.id)}>
                {t.id === 'basic' && 'Основное'}
                {t.id === 'rates' && 'Ставки'}
                {t.id === 'projects' && 'Проекты'}
              </button>))}
          </div>
          <div className="time-page__navbar-spacer"/>
          <span className={`uep__navbar-status uep__navbar-status--${statusKey}`}>{statusLabel}</span>
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
        </nav>
        <div className="time-page__content time-page__content--enter">
        <div className="uep-profile">
        <section className="uep-profile__hero" aria-label="Сводка">
          <div className="uep-profile__identity">
            <div className="uep-profile__avatar-wrap">
              {user.picture
                ? <img src={user.picture} alt="" className="uep-profile__avatar-img"/>
                : <span className="uep-profile__avatar-initials" aria-hidden>{initials}</span>}
              <span className={`uep-profile__status-dot uep-profile__status-dot--${statusKey}`} title={statusLabel}/>
            </div>
            <div className="uep-profile__id-block">
              <h1 className="uep-profile__name">
                {user.display_name ?? user.email}
                {isManualUser ? (<span className="uep-profile__manual-badge">Без входа в систему</span>) : null}
              </h1>
              <p className={`uep-profile__position${user.position?.trim() ? '' : ' uep-profile__position--empty'}`}>
                {user.position?.trim() || 'Должность не указана'}
              </p>
              <p className="uep-profile__email">{user.email}</p>
            </div>
          </div>
          <dl className="uep-profile__meta">
            <div className="uep-profile__meta-item">
              <dt>ID</dt>
              <dd>
                <span className="uep-profile__meta-mono">#{user.id}</span>
              </dd>
            </div>
            <div className="uep-profile__meta-item">
              <dt>Создан</dt>
              <dd>{new Date(user.created_at).toLocaleDateString('ru-RU')}</dd>
            </div>
            {user.updated_at && (<div className="uep-profile__meta-item">
                <dt>Обновлён</dt>
                <dd>{new Date(user.updated_at).toLocaleDateString('ru-RU')}</dd>
              </div>)}
            <div className="uep-profile__meta-item">
              <dt>Проектов</dt>
              <dd>{assignedProjectIds.length}</dd>
            </div>
          </dl>
        </section>
        {activeTab === 'basic' && (<div id="uep-panel-basic" role="tabpanel" aria-labelledby="uep-tab-basic" className="uep__tab-panel">
            <div className="uep__section">
              <div className="uep__section-head">
                <div className="uep__section-head-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="uep__section-head-text">
                  <h2 className="uep__section-title">Основные данные</h2>
                  <p className="uep__section-desc">
                    {isManualUser
            ? 'Сотрудник создан в учёте времени без регистрации в Microsoft. Имя и email редактируются только при создании записи.'
            : 'Данные аккаунта синхронизируются из Microsoft Azure AD.'}
                  </p>
                </div>
              </div>
              <div className="uep__form">
                <div className="uep__field-row">
                  <div className="uep__field">
                    <label className="uep__label">Имя</label>
                    <input type="text" className="uep__input uep__input--readonly" value={first} readOnly/>
                  </div>
                  <div className="uep__field">
                    <label className="uep__label">Фамилия</label>
                    <input type="text" className="uep__input uep__input--readonly" value={last} readOnly/>
                  </div>
                </div>
                {!isManualUser ? (
                  <div className="uep__field">
                    <label className="uep__label" htmlFor="uep-initials">Инициалы</label>
                    <div className="uep__initials-row">
                      <input
                        id="uep-initials"
                        type="text"
                        className="uep__input uep__input--initials"
                        value={initialsInput}
                        maxLength={8}
                        placeholder="Напр. ZUM"
                        disabled={initialsSaving}
                        onChange={(e) => {
                            setInitialsInput(normalizeInitialsInput(e.target.value));
                            setInitialsError(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter')
                                void persistInitials();
                        }}
                        onBlur={() => void persistInitials()}
                      />
                      <button
                        type="button"
                        className="uep__cap-save-btn"
                        disabled={initialsSaving}
                        onClick={() => void persistInitials()}
                      >
                        {initialsSaving ? 'Сохранение…' : initialsSaved ? 'Сохранено' : 'Сохранить'}
                      </button>
                    </div>
                    <p className="uep__hint">
                      Три буквы для отображения в интерфейсе (латиница или кириллица). Не синхронизируется с Azure AD.
                    </p>
                    {initialsError ? (
                      <p className="uep__field-error" role="alert">{initialsError}</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="uep__field">
                  <label className="uep__label">Рабочий email</label>
                  <input type="email" className="uep__input uep__input--readonly" value={user.email} readOnly/>
                  <p className="uep__hint">
                    {isManualUser
            ? 'Служебный email для справочника TT; в интерфейсе ориентируйтесь на ФИО.'
            : 'Email привязан к корпоративному аккаунту Microsoft и не может быть изменён здесь.'}
                  </p>
                </div>
        <div className="uep__cap-block">
                  <div className="uep__cap-label-wrap">
                    <span className="uep__cap-label">Нагрузка</span>
                  </div>
                  <div className="uep__cap-control">
                    <div className="uep__cap-select-wrap">
                      <select className="uep__cap-select" value={capCustom ? '__custom__' : String(capacity)} disabled={capSaving} onChange={(e) => void handleCapacityChange(e.target.value)}>
                        {CAPACITY_OPTIONS.map(h => (<option key={h} value={String(h)}>
                            {h}{h === CAPACITY_DEFAULT ? ' (по умолчанию)' : ''}
                          </option>))}
                        <option value="__custom__">Своё значение…</option>
                      </select>
                      <svg className="uep__cap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>

                    {capCustom && (<div className="uep__cap-custom-wrap">
                        <input type="number" min="1" max="168" className="uep__cap-custom-inp" placeholder="напр. 32" value={capCustomVal} onChange={e => setCapCustomVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleCapCustomSave()}/>
                        <button type="button" className="uep__cap-save-btn" disabled={capSaving} onClick={() => void handleCapCustomSave()}>
                          {capSaving ? 'Сохранение…' : 'Сохранить'}
                        </button>
                      </div>)}

                    <span className="uep__cap-unit">часов в неделю</span>

                    {capSaved && (<span className="uep__cap-saved">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Сохранено
                      </span>)}
                  </div>
                  <p className="uep__cap-hint">Количество часов в неделю, которые сотрудник доступен для работы.</p>
                  {user.weekly_capacity_hours == null && (<p className="uep__hint" style={{ marginTop: '0.35rem' }}>
                      В сервисе учёта времени норма ещё не задана; до сохранения показано значение по умолчанию ({CAPACITY_DEFAULT} ч).
                    </p>)}
                  {capError && (<p className="uep__field-error" role="alert" style={{ marginTop: '0.5rem' }}>
                      {capError}
                    </p>)}
                </div>

              </div>
            </div>
            </div>)}
        {activeTab === 'rates' && (<div id="uep-panel-rates" role="tabpanel" aria-labelledby="uep-tab-rates" className="uep__tab-panel">
            <div className="uep__section">
              <div className="uep__section-head">
                <div className="uep__section-head-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div className="uep__section-head-text">
                  <h2 className="uep__section-title">Ставки по умолчанию</h2>
                  <p className="uep__rates-desc" style={{ marginTop: '0.35rem' }}>
                    Для назначения на проект в валюте проекта нужна действующая <strong>оплачиваемая</strong> ставка в этой валюте.{' '}
                    <strong>Себестоимость</strong> для проверки доступа к проекту на стороне сервиса пока не требуется; её можно вести отдельно.
                  </p>
                </div>
              </div>
              <div className="uep__form">
                {ratesError && (<p className="uep__field-error" role="alert" style={{ marginBottom: '1rem' }}>{ratesError}</p>)}
                {ratesLoading && (<p className="uep__rates-desc" role="status">Загрузка ставок…</p>)}
        <div className="uep__rates-block">
                  <div className="uep__rates-header">
                    <div>
                      <h2 className="uep__rates-title">Оплачиваемые ставки</h2>
                      <p className="uep__rates-desc">
                        Ставка, по которой клиент оплачивает время этого сотрудника.
                        Только администраторы и менеджеры видят суммы.
                      </p>
                    </div>
                    <button type="button" className="uep__btn uep__btn--add" disabled={ratesLoading} onClick={() => setRateModal({ type: 'billable' })}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Новая ставка
                    </button>
                  </div>
                  {billableRates.length > 0 ? (<div className="uep__rates-table-wrap">
                      <table className="uep__rates-table">
                        <thead>
                          <tr>
                            <th>Ставка в час</th>
                            <th>Проект</th>
                            <th>Начало</th>
                            <th>Окончание</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {billableRates.map((r) => (<tr key={r.id}>
                              <td className="uep__rate-amount">{r.amount.toFixed(2)} <span className="uep__rate-currency">{r.currency}</span></td>
                              <td className="uep__rate-project">
                                {r.projectId
            ? <span className="uep__rate-project-tag">{rateProjectLabel(r)}</span>
            : <span className="uep__rate-all">Общая</span>}
                              </td>
                              <td className="uep__rate-date">{r.startDate ? fmtDate(r.startDate) : <span className="uep__rate-all">С начала</span>}</td>
                              <td className="uep__rate-date">{r.endDate ? fmtDate(r.endDate) : <span className="uep__rate-all">Без конца</span>}</td>
                              <td className="uep__rate-actions">
                                {canChangeBillableRateFromDate && (<button type="button" className="uep__rate-btn" onClick={() => setRateChangeFromModal({ type: 'billable', projectId: r.projectId ?? null, projectLabel: r.projectId ? rateProjectLabel(r) : null, currency: r.currency, currentAmount: r.amount, sourceRateId: r.id })}>Сменить с даты</button>)}
                                <button type="button" className="uep__rate-btn" onClick={() => setRateModal({ type: 'billable', rate: r })}>Изменить</button>
                                <button type="button" className="uep__rate-btn uep__rate-btn--del" onClick={() => void handleDeleteRate(r.id)}>Удалить</button>
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>) : (<div className="uep__rates-empty">Нет оплачиваемых ставок</div>)}
                  <p className="uep__hint" style={{ marginTop: '0.5rem' }}>
                    «Общая» ставка действует во всех проектах; проектная — только в своём проекте и имеет приоритет. Для одного проекта можно задать несколько периодов.
                  </p>
                </div>

                <div className="uep__divider"/>
            {costRatesForbidden ? (<div className="uep__rates-block">
                    <h2 className="uep__rates-title">Ставки себестоимости</h2>
                    <p className="uep__rates-empty" style={{ marginTop: '0.5rem' }}>
                      Просмотр и редактирование ставок себестоимости доступны только главному администратору и администратору.
                    </p>
                  </div>) : (<div className="uep__rates-block">
                  <div className="uep__rates-header">
                    <div>
                      <h2 className="uep__rates-title">Ставки себестоимости</h2>
                      <p className="uep__rates-desc">
                        Внутренние затраты на этого сотрудника. Общая ставка действует во всех проектах,
                        проектная — только в своём. Видны только администраторам.
                      </p>
                    </div>
                    <button type="button" className="uep__btn uep__btn--add" disabled={ratesLoading} onClick={() => setRateModal({ type: 'cost' })}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Новая ставка
                    </button>
                  </div>
                  {costRates.length > 0 ? (<div className="uep__rates-table-wrap">
                      <table className="uep__rates-table">
                        <thead>
                          <tr>
                            <th>Ставка в час</th>
                            <th>Проект</th>
                            <th>Начало</th>
                            <th>Окончание</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {costRates.map((r) => (<tr key={r.id}>
                              <td className="uep__rate-amount">{r.amount.toFixed(2)} <span className="uep__rate-currency">{r.currency}</span></td>
                              <td className="uep__rate-project">
                                {r.projectId
            ? <span className="uep__rate-project-tag">{rateProjectLabel(r)}</span>
            : <span className="uep__rate-all">Общая</span>}
                              </td>
                              <td className="uep__rate-date">{r.startDate ? fmtDate(r.startDate) : <span className="uep__rate-all">С начала</span>}</td>
                              <td className="uep__rate-date">{r.endDate ? fmtDate(r.endDate) : <span className="uep__rate-all">Без конца</span>}</td>
                              <td className="uep__rate-actions">
                                {canChangeCostRateFromDate && (<button type="button" className="uep__rate-btn" onClick={() => setRateChangeFromModal({ type: 'cost', projectId: r.projectId ?? null, projectLabel: r.projectId ? rateProjectLabel(r) : null, currency: r.currency, currentAmount: r.amount, sourceRateId: r.id })}>Сменить с даты</button>)}
                                <button type="button" className="uep__rate-btn" onClick={() => setRateModal({ type: 'cost', rate: r })}>Изменить</button>
                                <button type="button" className="uep__rate-btn uep__rate-btn--del" onClick={() => void handleDeleteRate(r.id)}>Удалить</button>
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>) : (<div className="uep__rates-empty">Нет ставок себестоимости</div>)}
                </div>)}

              </div>
            </div>
            </div>)}
        {activeTab === 'projects' && (() => {
            const catalogById = new Map(projectCatalog.map((p) => [p.id, p]));
            const assignedRows: ProjectListItem[] = assignedProjectIds.map((pid) => {
                const p = catalogById.get(pid);
                return p ?? { id: pid, name: 'Неизвестный проект', client: 'Не найден в каталоге', color: hashToColor(pid), archived: false };
            });
            const assignedActiveCount = assignedRows.filter((p) => !p.archived).length;
            const assignedArchivedCount = assignedRows.filter((p) => p.archived).length;
            const unassigned = projectCatalog.filter((p) => !assignedProjectIds.includes(p.id) && !p.archived);
            const q = projectSearch.trim().toLowerCase();
            const searchResults = q
                ? unassigned.filter((p) => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
                : unassigned;
            const displayResults = q ? searchResults : unassigned.slice(0, UEP_PROJECT_PICKER_CAP);
            const listTruncated = !q && unassigned.length > UEP_PROJECT_PICKER_CAP;
            const pickDisabled = !canEditTTProjectAccess || projectsTabSaving || projectsTabLoading;
            const assignedVisible = assignedRows.filter((p) => {
                if (assignedProjectsStatus === 'active' && p.archived)
                    return false;
                if (assignedProjectsStatus === 'archived' && !p.archived)
                    return false;
                if (!q)
                    return true;
                return p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q);
            });
            return (<div id="uep-panel-projects" role="tabpanel" aria-labelledby="uep-tab-projects" className="uep__tab-panel uep__tab-panel--flush">
                <div className="uep__proj-page">
                <div className="uep__proj-header">
                  <div className="uep__proj-header-text">
                    <h2 className="uep__proj-heading">
                      Назначенные проекты
                    </h2>
                    {!canEditTTProjectAccess && (<p className="uep__proj-subheading" style={{ marginTop: '0.35rem', opacity: 0.85 }}>
                        У вас нет прав на изменение доступа к проектам для этого пользователя.
                      </p>)}
                  </div>
                  {assignedProjectIds.length > 0 && canEditTTProjectAccess && (<button type="button" className="uep__proj-clear-btn" disabled={projectsTabSaving || projectsTabLoading} onClick={clearAllProjects}>
                      Убрать из всех
                    </button>)}
                </div>
                {projectsTabError && (<p className="uep__field-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                    {projectsTabError}
                  </p>)}
                {projectsTabLoading && (<p className="uep__proj-subheading" role="status" style={{ marginBottom: '0.75rem' }}>
                    Загрузка списка проектов…
                  </p>)}
                {projectsTabSaving && (<p className="uep__proj-subheading" role="status" style={{ marginBottom: '0.75rem' }}>
                    Сохранение…
                  </p>)}
                {canEditTTProjectAccess && !projectsTabLoading ? (
                    <div className="uep__proj-transfer-flag-wrap">
                        <label className="uep__proj-cb-label uep__proj-transfer-flag">
                            <input
                                type="checkbox"
                                checked={transferWithoutProjectAccess}
                                disabled={pickDisabled || transferFlagSaving}
                                onChange={(e) => void persistTransferWithoutProjectAccess(e.target.checked)}
                            />
                            <span className="uep__proj-check-box" aria-hidden="true"/>
                            <span className="uep__proj-transfer-flag-text">
                                Может переносить записи между проектами без доступа сотрудника к целевому проекту
                            </span>
                        </label>
                        <p className="uep__proj-subheading uep__proj-transfer-flag-hint" role="note">
                            Для пользователей с этим правом в переносе записей доступны все активные проекты, даже если у владельца записи нет доступа к целевому проекту.
                        </p>
                    </div>
                ) : null}
                <div className="uep__proj-search-wrap" ref={searchBoxRef}>
                  <div className="uep__proj-search-field">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" placeholder="Список ниже — введите текст, чтобы сузить по проекту или клиенту" value={projectSearch} disabled={projectsTabLoading} aria-expanded={searchOpen} aria-controls={searchOpen ? `${projPickListId}-listbox` : undefined} aria-autocomplete="list" onChange={(e) => {
                    setProjectSearch(e.target.value);
                    if (canEditTTProjectAccess)
                        setSearchOpen(true);
                }} onFocus={() => {
                    if (canEditTTProjectAccess)
                        setSearchOpen(true);
                }} onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        setSearchOpen(false);
                    }
                }} onBlur={() => setTimeout(() => setSearchOpen(false), 160)}/>
                    {projectSearch && (<button type="button" onMouseDown={(e) => {
                        e.preventDefault();
                        setProjectSearch('');
                        setSearchOpen(false);
                    }} aria-label="Очистить">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>)}
                  </div>
                  {searchOpen &&
                    !projectsTabLoading &&
                    canEditTTProjectAccess &&
                    createPortal((() => {
                        const rect = searchBoxRef.current?.getBoundingClientRect();
                        if (!rect)
                            return null;
                        return (<div id={`${projPickListId}-listbox`} role="listbox" aria-label="Проекты для назначения" className="uep__proj-drop" style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}>
                            {unassigned.length === 0 ? (<p className="uep__proj-drop-empty">
                                Все проекты из каталога уже назначены этому сотруднику.
                              </p>) : displayResults.length === 0 ? (<p className="uep__proj-drop-empty">Ничего не найдено — измените запрос</p>) : (<>
                                {displayResults.map((p) => (<button key={p.id} type="button" role="option" className="uep__proj-drop-item" disabled={pickDisabled} onMouseDown={() => {
                                        if (pickDisabled)
                                            return;
                                        assignProject(p.id);
                                        setSearchOpen(false);
                                    }}>
                                    <span className="uep__proj-color-dot" style={{ background: p.color }}/>
                                    <span className="uep__proj-drop-info">
                                      <span className="uep__proj-drop-name">{p.name}</span>
                                      <span className="uep__proj-drop-client">{p.client}</span>
                                    </span>
                                    <svg className="uep__proj-drop-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                      <line x1="12" y1="5" x2="12" y2="19"/>
                                      <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                  </button>))}
                                {listTruncated && (<p className="uep__proj-drop-hint" role="note">
                                    Показаны первые {UEP_PROJECT_PICKER_CAP} из {unassigned.length}. Введите часть названия
                                    проекта или клиента, чтобы сузить список.
                                  </p>)}
                              </>)}
                          </div>);
                    })(), document.body)}
                </div>

                <div className="uep__proj-status-block">
                  <p className="uep__proj-status-title" id="uep-proj-status-heading">Статус проектов</p>
                  <nav className="uep__proj-status-nav" role="tablist" aria-labelledby="uep-proj-status-heading">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={assignedProjectsStatus === 'active'}
                      className={`uep__proj-status-tab${assignedProjectsStatus === 'active' ? ' uep__proj-status-tab--active' : ''}`}
                      onClick={() => setAssignedProjectsStatus('active')}
                    >
                      Активные
                      <span className="uep__proj-status-count">{assignedActiveCount}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={assignedProjectsStatus === 'archived'}
                      className={`uep__proj-status-tab${assignedProjectsStatus === 'archived' ? ' uep__proj-status-tab--active' : ''}`}
                      onClick={() => setAssignedProjectsStatus('archived')}
                    >
                      Архивные
                      <span className="uep__proj-status-count">{assignedArchivedCount}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={assignedProjectsStatus === 'all'}
                      className={`uep__proj-status-tab${assignedProjectsStatus === 'all' ? ' uep__proj-status-tab--active' : ''}`}
                      onClick={() => setAssignedProjectsStatus('all')}
                    >
                      Все
                      <span className="uep__proj-status-count">{assignedRows.length}</span>
                    </button>
                  </nav>
                </div>

                <div className="uep__proj-period">
                  <div className="uep__proj-period-left">
                    <button
                      type="button"
                      className="uep__proj-period-nav"
                      onClick={() => setProjPeriodDate((d) => shiftPeriodDate(d, projPeriodGranularity, -1))}
                      disabled={projPeriodGranularity === 'all'}
                      aria-label="Предыдущий период"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M15 18l-6-6 6-6"/>
                      </svg>
                    </button>
                    <h3 className="uep__proj-period-title">{projPeriodTitle}</h3>
                    <button
                      type="button"
                      className="uep__proj-period-nav"
                      onClick={() => setProjPeriodDate((d) => shiftPeriodDate(d, projPeriodGranularity, 1))}
                      disabled={projPeriodGranularity === 'all'}
                      aria-label="Следующий период"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
                  <div className="uep__proj-period-dropdown-wrap" ref={projPeriodDropdownRef}>
                    <button
                      type="button"
                      className="uep__proj-period-dropdown-btn"
                      onClick={() => setProjPeriodDropdown((v) => !v)}
                      aria-expanded={projPeriodDropdown}
                    >
                      {PERIOD_OPTIONS.find((o) => o.id === projPeriodGranularity)?.label ?? 'Месяц'}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                    {projPeriodDropdown ? (
                      <div className="uep__proj-period-dropdown" role="listbox">
                        {PERIOD_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            role="option"
                            aria-selected={projPeriodGranularity === opt.id}
                            className={`uep__proj-period-opt${projPeriodGranularity === opt.id ? ' uep__proj-period-opt--active' : ''}`}
                            onClick={() => {
                              setProjPeriodGranularity(opt.id);
                              setProjPeriodDropdown(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {projectActivityLoading && (
                  <p className="uep__proj-subheading" role="status" style={{ marginBottom: '0.75rem' }}>
                    Загрузка активности за период…
                  </p>
                )}
                {projectActivityError && (
                  <p className="uep__field-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                    {projectActivityError}
                  </p>
                )}

                {assignedRows.length === 0 ? (<div className="uep__proj-empty">
                    <div className="uep__proj-empty-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/>
                        <path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/>
                      </svg>
                    </div>
                    <p className="uep__proj-empty-title">Проекты не назначены</p>
                    <p className="uep__proj-empty-hint">
                      Откройте список выше (фокус в поле) и добавьте проект или сузьте список поиском
                    </p>
                  </div>) : assignedVisible.length === 0 ? (<div className="uep__proj-empty uep__proj-empty--filter">
                    <p className="uep__proj-empty-title">
                      {assignedProjectsStatus === 'active'
                        ? 'Нет активных назначенных проектов'
                        : assignedProjectsStatus === 'archived'
                          ? 'Нет архивных назначенных проектов'
                          : 'Ничего не найдено'}
                    </p>
                    <p className="uep__proj-empty-hint">
                      {q
                        ? 'Измените поисковый запрос или переключите фильтр статуса'
                        : 'Переключите фильтр статуса или назначьте проекты через поле выше'}
                    </p>
                  </div>) : (<div className="uep__proj-list">
                    <div className="uep__proj-list-head">
                      <span>
                        Проект
                        <span className="uep__proj-list-head-meta">{assignedVisible.length}</span>
                      </span>
                      <span className="uep__proj-list-head-hours">Время</span>
                      <span className="uep__proj-list-head-action">Отчёт</span>
                    </div>
                    {assignedVisible.map((p) => {
                      const hours = projectHoursById[p.id] ?? 0;
                      return (
                        <div key={p.id} className={`uep__proj-item${p.archived ? ' uep__proj-item--archived' : ''}`}>
                          <button type="button" className="uep__proj-item-remove" disabled={pickDisabled} onClick={() => removeProject(p.id)} title={`Убрать из ${p.name}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </button>
                          <span className="uep__proj-color-dot" style={{ background: p.color }}/>
                          <span className="uep__proj-item-info">
                            <span className="uep__proj-item-name">
                              {p.name}
                              {p.archived ? <span className="uep__proj-arch-badge">Архив</span> : null}
                            </span>
                            <span className="uep__proj-item-client">{p.client}</span>
                          </span>
                          <span className="uep__proj-item-hours" title={`Время за период: ${fmtH(hours)}`}>
                            {projectActivityLoading ? '…' : fmtH(hours)}
                          </span>
                          <button
                            type="button"
                            className="uep__proj-item-preview"
                            onClick={() => openProjectReportPreview(p.id)}
                            title={`Предпросмотр отчёта: ${p.name}`}
                          >
                            Предпросмотр
                          </button>
                        </div>
                      );
                    })}
                  </div>)}
              </div>
              </div>);
        })()}

        </div>
        </div>
        </main>
        {rateModal && (<RateFormModal type={rateModal.type} rate={rateModal.rate} existingRates={rates.filter((r) => r.type === rateModal.type && r.id !== rateModal.rate?.id)} projects={rateProjectOptions} onSave={handleSaveRate} onClose={() => setRateModal(null)}/>)}
        {rateChangeFromModal && (<RateChangeFromModal type={rateChangeFromModal.type} projectLabel={rateChangeFromModal.projectLabel} currency={rateChangeFromModal.currency} currentAmount={rateChangeFromModal.currentAmount} onSave={handleChangeRateFrom} onClose={() => setRateChangeFromModal(null)}/>)}
    </div>);
}
