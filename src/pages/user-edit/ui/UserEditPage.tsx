import { useState, useEffect, useId, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getUser, type User, } from '@entities/user';
import { upsertTimeTrackingUser, listHourlyRates, createHourlyRate, patchHourlyRate, deleteHourlyRate, getUserProjectAccess, putUserProjectAccess, listAllClientProjectsForPicker, listAllTimeManagerClientsMerged, isForbiddenError, userFacingProjectAccessError, TIME_TRACKING_PROJECT_CURRENCIES, type HourlyRateRow, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { useCurrentUser } from '@shared/hooks';
import { AppPageSettings } from '@shared/ui';
import { canManageUserProjectAccess } from '@entities/time-tracking/model/timeManagerClientsAccess';
import '@pages/time-tracking/ui/TimeTrackingPage.css';
import './UserEditPage.css';
type TabId = 'basic' | 'rates' | 'projects';
const TAB_IDS: TabId[] = ['basic', 'rates', 'projects'];
function tabFromSearchParam(raw: string | null): TabId {
    if (raw === 'basic' || raw === 'rates' || raw === 'projects')
        return raw;
    return 'basic';
}
type RateType = 'billable' | 'cost';
type Rate = {
    id: string;
    type: RateType;
    amount: number;
    currency: string;
    startDate: string | null;
    endDate: string | null;
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
    };
}
type ProjectListItem = {
    id: string;
    name: string;
    client: string;
    color: string;
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
    }));
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
type RateFormProps = {
    rate?: Rate;
    type: RateType;
    onSave: (r: Omit<Rate, 'id'>) => void | Promise<void>;
    onClose: () => void;
};
function RateFormModal({ rate, type, onSave, onClose }: RateFormProps) {
    const [amount, setAmount] = useState(rate ? String(rate.amount) : '');
    const [currency, setCurrency] = useState(rate?.currency ?? 'USD');
    const [startDate, setStartDate] = useState(rate?.startDate ?? '');
    const [endDate, setEndDate] = useState(rate?.endDate ?? '');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const uid = useId();
    const handleSubmit = async () => {
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) {
            setError('Введите корректную сумму');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await Promise.resolve(onSave({ type, amount: amt, currency, startDate: startDate || null, endDate: endDate || null }));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="uep__modal-overlay" onClick={onClose}>
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
export function UserEditPage() {
    const { id } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentEditor } = useCurrentUser();
    const canEditTTProjectAccess = canManageUserProjectAccess(currentEditor?.role, currentEditor?.time_tracking_role ?? null);
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
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState<string | null>(null);
    const [costRatesForbidden, setCostRatesForbidden] = useState(false);
    const [projectCatalog, setProjectCatalog] = useState<ProjectListItem[]>([]);
    const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
    const [projectsTabLoading, setProjectsTabLoading] = useState(false);
    const [projectsTabError, setProjectsTabError] = useState<string | null>(null);
    const [projectsTabSaving, setProjectsTabSaving] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const projPickListId = useId();
    const [capacity, setCapacity] = useState<number>(CAPACITY_DEFAULT);
    const [capCustom, setCapCustom] = useState(false);
    const [capCustomVal, setCapCustomVal] = useState('');
    const [capSaved, setCapSaved] = useState(false);
    const [capSaving, setCapSaving] = useState(false);
    const [capError, setCapError] = useState<string | null>(null);
    useEffect(() => {
        if (!id)
            return;
        setLoading(true);
        setFetchError(null);
        getUser(Number(id))
            .then((u) => {
            setUser(u);
            setRates([]);
            setRatesError(null);
            setCostRatesForbidden(false);
            setAssignedProjectIds([]);
            setProjectCatalog([]);
            setProjectsTabError(null);
            const capSt = capacityStateFromUser(u);
            setCapacity(capSt.capacity);
            setCapCustom(capSt.capCustom);
            setCapCustomVal(capSt.capCustomVal);
            setCapError(null);
        })
            .catch((e: unknown) => setFetchError((e as Error).message ?? 'Ошибка загрузки'))
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
    }, [user]);
    const persistCapacityHours = useCallback(async (hours: number) => {
        if (!user)
            return;
        if (hours <= 0 || hours > 168)
            return;
        setCapError(null);
        setCapSaving(true);
        try {
            await upsertTimeTrackingUser(user, { weeklyCapacityHours: hours });
            setUser((prev) => (prev ? { ...prev, weekly_capacity_hours: hours } : null));
            setCapSaved(true);
            setTimeout(() => setCapSaved(false), 2000);
        }
        catch (e) {
            setCapError(e instanceof Error ? e.message : 'Не удалось сохранить');
        }
        finally {
            setCapSaving(false);
        }
    }, [user]);
    useEffect(() => {
        if (!user || activeTab !== 'rates')
            return;
        void refreshRates();
    }, [user?.id, activeTab, refreshRates]);
    useEffect(() => {
        if (!user || activeTab !== 'projects')
            return;
        let cancelled = false;
        setProjectsTabLoading(true);
        setProjectsTabError(null);
        (async () => {
            try {
                await upsertTimeTrackingUser(user);
                const [clients, access, catalogRows] = await Promise.all([
                    listAllTimeManagerClientsMerged(),
                    getUserProjectAccess(user.id),
                    listAllClientProjectsForPicker(),
                ]);
                if (cancelled)
                    return;
                const nameById = new Map(clients.map((c) => [c.id, c.name]));
                setProjectCatalog(buildProjectCatalog(catalogRows, nameById));
                setAssignedProjectIds(access.projectIds);
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
    }, [user?.id, activeTab]);
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
    const handleSaveRate = async (data: Omit<Rate, 'id'>) => {
        if (!user)
            return;
        const rateKind = data.type === 'cost' ? 'cost' : 'billable';
        if (rateModal?.rate) {
            await patchHourlyRate(user.id, rateModal.rate.id, {
                amount: String(data.amount),
                currency: data.currency,
                validFrom: data.startDate,
                validTo: data.endDate,
            });
        }
        else {
            await createHourlyRate(user.id, {
                rateKind,
                amount: String(data.amount),
                currency: data.currency,
                validFrom: data.startDate,
                validTo: data.endDate,
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
            <button type="button" className="uep__back-btn" onClick={() => navigate(-1)}>← Назад</button>
          </div>
        </main>
      </div>);
    }
    const { first, last } = splitName(user.display_name);
    const initials = getInitials(user.display_name, user.email);
    const statusKey = user.is_archived ? 'archived' : user.is_blocked ? 'blocked' : 'active';
    const statusLabel = user.is_archived ? 'В архиве' : user.is_blocked ? 'Заблокирован' : 'Активен';
    const billableRates = rates.filter((r) => r.type === 'billable');
    const costRates = rates.filter((r) => r.type === 'cost');
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
          <button type="button" className="time-page__back-btn" onClick={() => navigate(-1)} aria-label="Назад">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span className="time-page__back-label">Назад</span>
          </button>
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
              <h1 className="uep-profile__name">{user.display_name ?? user.email}</h1>
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
                  <p className="uep__section-desc">Данные аккаунта синхронизируются из Microsoft Azure AD.</p>
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
                <div className="uep__field">
                  <label className="uep__label">Рабочий email</label>
                  <input type="email" className="uep__input uep__input--readonly" value={user.email} readOnly/>
                  <p className="uep__hint">Email привязан к корпоративному аккаунту Microsoft и не может быть изменён здесь.</p>
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
                            <th>Начало</th>
                            <th>Окончание</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {billableRates.map((r) => (<tr key={r.id}>
                              <td className="uep__rate-amount">{r.amount.toFixed(2)} <span className="uep__rate-currency">{r.currency}</span></td>
                              <td className="uep__rate-date">{r.startDate ? fmtDate(r.startDate) : <span className="uep__rate-all">С начала</span>}</td>
                              <td className="uep__rate-date">{r.endDate ? fmtDate(r.endDate) : <span className="uep__rate-all">Без конца</span>}</td>
                              <td className="uep__rate-actions">
                                <button type="button" className="uep__rate-btn" onClick={() => setRateModal({ type: 'billable', rate: r })}>Изменить</button>
                                <button type="button" className="uep__rate-btn uep__rate-btn--del" onClick={() => void handleDeleteRate(r.id)}>Удалить</button>
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>) : (<div className="uep__rates-empty">Нет оплачиваемых ставок</div>)}
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
                        Внутренние затраты на этого сотрудника. Применяются ко всем проектам.
                        Видны только администраторам.
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
                            <th>Начало</th>
                            <th>Окончание</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {costRates.map((r) => (<tr key={r.id}>
                              <td className="uep__rate-amount">{r.amount.toFixed(2)} <span className="uep__rate-currency">{r.currency}</span></td>
                              <td className="uep__rate-date">{r.startDate ? fmtDate(r.startDate) : <span className="uep__rate-all">С начала</span>}</td>
                              <td className="uep__rate-date">{r.endDate ? fmtDate(r.endDate) : <span className="uep__rate-all">Без конца</span>}</td>
                              <td className="uep__rate-actions">
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
                return p ?? { id: pid, name: 'Проект недоступен', client: '', color: hashToColor(pid) };
            });
            const unassigned = projectCatalog.filter((p) => !assignedProjectIds.includes(p.id));
            const q = projectSearch.trim().toLowerCase();
            const searchResults = q
                ? unassigned.filter((p) => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q))
                : unassigned;
            const displayResults = q ? searchResults : unassigned.slice(0, UEP_PROJECT_PICKER_CAP);
            const listTruncated = !q && unassigned.length > UEP_PROJECT_PICKER_CAP;
            const pickDisabled = !canEditTTProjectAccess || projectsTabSaving || projectsTabLoading;
            return (<div id="uep-panel-projects" role="tabpanel" aria-labelledby="uep-tab-projects" className="uep__tab-panel uep__tab-panel--flush">
                <div className="uep__proj-page">
                <div className="uep__proj-header">
                  <div className="uep__proj-header-text">
                    <h2 className="uep__proj-heading">
                      Назначенные проекты
                    </h2>
                    <p className="uep__proj-subheading">
                      {first ? first : 'Сотрудник'} может отслеживать время только по назначенным проектам (данные из сервиса учёта времени). При сохранении доступа сервер проверяет, что на текущую дату задана почасовая ставка{' '}
                      <strong>оплачиваемая (billable)</strong> в <strong>валюте проекта</strong> — при несоответствии вернётся ошибка с текстом (см. вкладку «Ставки»). <strong>Себестоимость (cost)</strong> для этой проверки пока не требуется. Если к проекту уже назначены сотрудники, среди них должен быть минимум один <strong>партнёр</strong> по полю «должность» в профиле (слово «партнёр» / <code className="uep__proj-hint-code">partner</code>); иначе возможен ответ 400 с пояснением.
                    </p>
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
                <div className="uep__proj-search-wrap" ref={searchBoxRef}>
                  <div className="uep__proj-search-field">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" placeholder="Список ниже — введите текст, чтобы сузить по проекту или клиенту" value={projectSearch} disabled={projectsTabLoading || !canEditTTProjectAccess} aria-expanded={searchOpen} aria-controls={searchOpen ? `${projPickListId}-listbox` : undefined} aria-autocomplete="list" onChange={(e) => {
                    setProjectSearch(e.target.value);
                    setSearchOpen(true);
                }} onFocus={() => setSearchOpen(true)} onKeyDown={(e) => {
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
                  </div>) : (<div className="uep__proj-list">
                    <div className="uep__proj-list-head">
                      <span>Проект</span>
                    </div>
                    {assignedRows.map((p) => (<div key={p.id} className="uep__proj-item">
                        <button type="button" className="uep__proj-item-remove" disabled={pickDisabled} onClick={() => removeProject(p.id)} title={`Убрать из ${p.name}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                        <span className="uep__proj-color-dot" style={{ background: p.color }}/>
                        <span className="uep__proj-item-info">
                          <span className="uep__proj-item-name">{p.name}</span>
                          <span className="uep__proj-item-client">{p.client}</span>
                        </span>
                      </div>))}
                  </div>)}
              </div>
              </div>);
        })()}

        </div>
        </div>
        </main>
        {rateModal && (<RateFormModal type={rateModal.type} rate={rateModal.rate} onSave={handleSaveRate} onClose={() => setRateModal(null)}/>)}
    </div>);
}
