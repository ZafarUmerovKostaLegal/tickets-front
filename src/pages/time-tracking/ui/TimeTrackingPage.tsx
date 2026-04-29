import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { AppPageSettings } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from '@entities/time-tracking';
import type { TimeTabId } from '@entities/time-tracking/model/types';
import { TABS } from '@entities/time-tracking/model/constants';
import { canAccessTimeTracking, getVisibleTimeTrackingTabs, getVisibleTimeTrackingTabDefs, hasFullTimeTrackingTabs, resolveInitialTimeTab, } from '@entities/time-tracking/model/timeTrackingAccess';
import { TimeUsersPanel } from './TimeUsersPanel';
import { ExpensesPanel } from './ExpensesPanel';
import { ProjectsPanel } from './ProjectsPanel';
import { TimesheetPanel } from './TimesheetPanel';
import { ReportsPanel } from './ReportsPanel';
import { InvoicesPanel } from './InvoicesPanel';
import { TimeTrackingSettingsPanel } from './TimeTrackingSettingsPanel';
import { TimeTrackingClientsPanel } from './TimeTrackingClientsPanel';
import './TimeTrackingPage.css';
function nameInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function nameToHue(name: string): number {
    let h = 0;
    for (let i = 0; i < name.length; i++)
        h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % 360;
}
type ScopeUser = {
    id: number;
    display_name?: string | null;
    email?: string | null;
};
function UserAvatar({ user, size = 28 }: {
    user: ScopeUser;
    size?: number;
}) {
    const name = user.display_name?.trim() || user.email || String(user.id);
    const hue = nameToHue(name);
    const initials = nameInitials(name);
    return (<span className="tt-scope-avatar" style={{
            width: size,
            height: size,
            fontSize: size * 0.38,
            background: `hsl(${hue},55%,52%)`,
        }} aria-hidden>
      {initials}
    </span>);
}
type EmployeeScopePickerProps = {
    currentUser: ScopeUser & {
        display_name?: string | null;
        email?: string | null;
    };
    ttScopeUsers: TimeTrackingUserRow[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
};
function EmployeeScopePicker({ currentUser, ttScopeUsers, selectedId, onSelect }: EmployeeScopePickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const activeId = selectedId ?? currentUser.id;
    const options = useMemo(() => {
        const selfName = currentUser.display_name?.trim() || currentUser.email || `id ${currentUser.id}`;
        const self = { id: currentUser.id, display_name: `Я (${selfName})`, email: currentUser.email };
        const others = ttScopeUsers
            .filter((r) => r.id !== currentUser.id && !r.is_archived && !r.is_blocked)
            .sort((a, b) => {
            const na = (a.display_name?.trim() || a.email || '').toLowerCase();
            const nb = (b.display_name?.trim() || b.email || '').toLowerCase();
            return na.localeCompare(nb, 'ru');
        });
        return [self, ...others];
    }, [currentUser, ttScopeUsers]);
    const filtered = useMemo(() => {
        if (!query.trim())
            return options;
        const q = query.toLowerCase();
        return options.filter((u) => (u.display_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q));
    }, [options, query]);
    useEffect(() => {
        if (!open)
            return;
        function onDown(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);
    useEffect(() => {
        if (open)
            setTimeout(() => inputRef.current?.focus(), 40);
    }, [open]);
    const activeUser = options.find((u) => u.id === activeId) ?? options[0];
    const activeName = activeUser?.display_name?.trim() || activeUser?.email || '';
    function handleSelect(id: number) {
        onSelect(id === currentUser.id ? null : id);
        setOpen(false);
        setQuery('');
    }
    return (<div className="tt-scope-picker" ref={wrapRef}>
      <button type="button" className={`tt-scope-trigger${open ? ' tt-scope-trigger--open' : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <UserAvatar user={activeUser ?? currentUser} size={26}/>
        <span className="tt-scope-trigger__name">{activeName}</span>
        <svg className="tt-scope-trigger__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (<div className="tt-scope-panel" role="listbox" aria-label="Выбор сотрудника">
          <div className="tt-scope-panel__header">
            <span className="tt-scope-panel__title">Сотрудник</span>
          </div>
          {options.length > 5 && (<div className="tt-scope-panel__search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input ref={inputRef} className="tt-scope-panel__search-input" placeholder="Поиск…" value={query} onChange={(e) => setQuery(e.target.value)}/>
              {query && (<button type="button" className="tt-scope-panel__search-clear" onClick={() => setQuery('')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>)}
            </div>)}
          <ul className="tt-scope-panel__list">
            {filtered.length === 0 && (<li className="tt-scope-panel__empty">Не найдено</li>)}
            {filtered.map((u) => {
                const isActive = u.id === activeId;
                const name = u.display_name?.trim() || u.email || `id ${u.id}`;
                return (<li key={u.id}>
                  <button type="button" role="option" aria-selected={isActive} className={`tt-scope-panel__item${isActive ? ' tt-scope-panel__item--active' : ''}`} onClick={() => handleSelect(u.id)}>
                    <UserAvatar user={u} size={30}/>
                    <span className="tt-scope-panel__item-name">{name}</span>
                    {isActive && (<svg className="tt-scope-panel__check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>)}
                  </button>
                </li>);
            })}
          </ul>
        </div>)}
    </div>);
}
const IconLock = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>);
function TimePageInitSkeleton() {
    return (<div className="time-page-init-skel" aria-hidden="true">
      
      <div className="time-page-init-skel__strip">
        <div className="time-page-init-skel__strip-left">
          <span className="time-page-init-skel__btn-sm"/>
          <span className="time-page-init-skel__btn-sm"/>
          <span className="time-page-init-skel__heading"/>
          <span className="time-page-init-skel__btn-sm"/>
        </div>
        <div className="time-page-init-skel__strip-right">
          <span className="time-page-init-skel__seg-btn"/>
          <span className="time-page-init-skel__seg-btn"/>
        </div>
      </div>

      
      <div className="time-page-init-skel__days">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (<div key={i} className="time-page-init-skel__day" style={{ animationDelay: `${i * 0.04}s` }}>
            <span className="time-page-init-skel__day-label"/>
            <span className="time-page-init-skel__day-num"/>
            <div className="time-page-init-skel__day-bar-wrap">
              <span className="time-page-init-skel__day-bar" style={{ height: `${20 + Math.sin(i) * 18}%` }}/>
            </div>
            <span className="time-page-init-skel__day-h"/>
          </div>))}
        
        <div className="time-page-init-skel__total-col">
          <span className="time-page-init-skel__total-label"/>
          <span className="time-page-init-skel__total-num"/>
        </div>
      </div>

      
      <div className="time-page-init-skel__entries">
        {[1, 2, 3].map((i) => (<div key={i} className="time-page-init-skel__row" style={{ animationDelay: `${i * 0.06}s` }}>
            <span className="time-page-init-skel__row-color"/>
            <div className="time-page-init-skel__row-text">
              <span className="time-page-init-skel__row-proj" style={{ width: `${55 + i * 12}%` }}/>
              <span className="time-page-init-skel__row-task" style={{ width: `${35 + i * 8}%` }}/>
            </div>
            <div className="time-page-init-skel__row-cells">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (<span key={d} className="time-page-init-skel__cell"/>))}
            </div>
          </div>))}
      </div>
    </div>);
}
const VALID_TABS = TABS.map(t => t.id);
function readTabFromUrl(): TimeTabId | null {
    try {
        const q = new URLSearchParams(window.location.search).get('tab');
        if (q && VALID_TABS.includes(q as TimeTabId))
            return q as TimeTabId;
    }
    catch {
    }
    return null;
}
const TT_SCOPE_STORAGE = 'tt_manager_scope_user_id';
function readStoredScopeUserId(): number | null {
    try {
        const raw = sessionStorage.getItem(TT_SCOPE_STORAGE);
        if (raw == null || raw === '')
            return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    catch {
        return null;
    }
}
export function TimeTrackingPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, loading } = useCurrentUser();
    const [activeTab, setActiveTab] = useState<TimeTabId>(() => readTabFromUrl() ?? 'timesheet');
    const [managedScopeUserId, setManagedScopeUserId] = useState<number | null>(() => readStoredScopeUserId());
    const [ttScopeUsers, setTtScopeUsers] = useState<TimeTrackingUserRow[]>([]);
    const [ttScopeLoadError, setTtScopeLoadError] = useState<string | null>(null);
    const handleBack = useCallback(() => navigate(routes.home), [navigate]);
    const hasAccess = !loading && canAccessTimeTracking(user);
    const accessDenied = !loading && user != null && !canAccessTimeTracking(user);
    const visibleTabDefs = useMemo(() => getVisibleTimeTrackingTabDefs(user), [user]);
    const isTtManager = Boolean(user && hasFullTimeTrackingTabs(user));
    useEffect(() => {
        if (loading || !user || !hasAccess)
            return;
        const allowed = getVisibleTimeTrackingTabs(user);
        if (!allowed.includes(activeTab))
            return;
        const urlTab = searchParams.get('tab');
        if (urlTab === activeTab)
            return;
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set('tab', activeTab);
            return p;
        }, { replace: true });
    }, [activeTab, loading, user, hasAccess, searchParams, setSearchParams]);
    useEffect(() => {
        if (loading || !user || !isTtManager) {
            setTtScopeUsers([]);
            setTtScopeLoadError(null);
            return;
        }
        let cancelled = false;
        void listTimeTrackingUsers()
            .then((rows) => {
            if (cancelled)
                return;
            setTtScopeUsers(Array.isArray(rows) ? rows : []);
            setTtScopeLoadError(null);
        })
            .catch((e: unknown) => {
            if (cancelled)
                return;
            setTtScopeUsers([]);
            const msg = e instanceof Error ? e.message : String(e);
            setTtScopeLoadError(/403|forbidden|недостаточно|запрещ/i.test(msg)
                ? 'Список сотрудников недоступен: вы не синхронизированы в учёте времени или нет роли менеджера. Обратитесь к администратору.'
                : msg || 'Не удалось загрузить список пользователей учёта времени');
        });
        return () => {
            cancelled = true;
        };
    }, [loading, user, isTtManager]);
    const managedEntriesUserRow = useMemo(() => {
        if (!user || managedScopeUserId == null || managedScopeUserId === user.id)
            return null;
        return ttScopeUsers.find((r) => r.id === managedScopeUserId) ?? null;
    }, [user, managedScopeUserId, ttScopeUsers]);
    const setManagedScope = useCallback((id: number | null) => {
        setManagedScopeUserId(id);
        try {
            if (id == null || id <= 0)
                sessionStorage.removeItem(TT_SCOPE_STORAGE);
            else
                sessionStorage.setItem(TT_SCOPE_STORAGE, String(id));
        }
        catch {
        }
    }, []);
    useEffect(() => {
        if (!user?.id)
            return;
        if (managedScopeUserId == null || managedScopeUserId === user.id)
            return;
        if (ttScopeUsers.length === 0)
            return;
        if (!ttScopeUsers.some((r) => r.id === managedScopeUserId)) {
            setManagedScope(null);
        }
    }, [user?.id, managedScopeUserId, ttScopeUsers, setManagedScope]);
    useEffect(() => {
        if (loading || !user)
            return;
        const allowed = getVisibleTimeTrackingTabs(user);
        if (allowed.length === 0)
            return;
        setActiveTab(prev => {
            if (allowed.includes(prev))
                return prev;
            return resolveInitialTimeTab(user, readTabFromUrl());
        });
    }, [loading, user]);
    function handleTabChange(id: TimeTabId) {
        if (!getVisibleTimeTrackingTabs(user).includes(id))
            return;
        if (id === activeTab)
            return;
        setActiveTab(id);
    }
    const headerManagerTrailing = useMemo(() => {
        if (loading || !hasAccess || !user || !isTtManager)
            return null;
        if (activeTab !== 'timesheet' && activeTab !== 'expenses')
            return null;
        if (ttScopeLoadError) {
            return (<div className="time-page__navbar-manager">
          <span className="time-page__navbar-manager-err" title={ttScopeLoadError}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Нет доступа
          </span>
        </div>);
        }
        return (<div className="time-page__navbar-manager">
        <EmployeeScopePicker currentUser={user} ttScopeUsers={ttScopeUsers} selectedId={managedScopeUserId} onSelect={setManagedScope}/>
      </div>);
    }, [
        loading,
        hasAccess,
        user,
        isTtManager,
        activeTab,
        ttScopeLoadError,
        managedScopeUserId,
        ttScopeUsers,
        setManagedScope,
    ]);
    return (<div className="time-page time-page--enter">
      <main className="time-page__main">
        {accessDenied && (<div className="time-page__dev-overlay" role="status" aria-label="Нет доступа к учёту времени">
            <div className="time-page__dev-overlay-inner">
              <span className="time-page__dev-overlay-icon" aria-hidden><IconLock /></span>
              <p className="time-page__dev-overlay-text">
                Нет доступа к учёту времени. Администратор должен назначить роль учёта времени
                «Пользователь» или «Менеджер» в карточке пользователя.
              </p>
              <button type="button" className="time-page__dev-overlay-back" onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Назад
              </button>
            </div>
          </div>)}
        
        <nav className="time-page__navbar" aria-label="Навигация учёта времени">
          <button type="button" className="time-page__back-btn" onClick={handleBack} aria-label="Назад">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span className="time-page__back-label">Назад</span>
          </button>
          <div className="time-page__navbar-sep" aria-hidden="true"/>
          <span className="time-page__navbar-title">Учёт времени</span>
          {loading ? (<>
              <div className="time-page__navbar-sep" aria-hidden="true"/>
              <div className="time-page__navbar-tabs time-page__navbar-tabs--skel" aria-hidden="true">
                {[118, 60, 56, 48, 58, 66, 80, 64].map((w, i) => (<span key={i} className="time-page__navbar-tab-skel" style={{ width: w }}/>))}
              </div>
            </>) : hasAccess && user ? (<>
              <div className="time-page__navbar-sep" aria-hidden="true"/>
              <div className="time-page__navbar-tabs" role="tablist" aria-label="Разделы учёта времени">
                {visibleTabDefs.map((tab) => (<button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`time-tab-${tab.id}`} id={`time-tab-btn-${tab.id}`} className={`time-page__navbar-tab${activeTab === tab.id ? ' time-page__navbar-tab--active' : ''}`} onClick={() => handleTabChange(tab.id)}>
                    {tab.label}
                  </button>))}
              </div>
            </>) : null}
          <div className="time-page__navbar-spacer"/>
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
          {headerManagerTrailing}
        </nav>
        {loading && <TimePageInitSkeleton />}
        {hasAccess && user && (<>
                {activeTab === 'users' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-users" aria-labelledby="time-tab-btn-users">
                    <TimeUsersPanel />
                  </div>)}
                {activeTab === 'projects' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-projects" aria-labelledby="time-tab-btn-projects">
                    <ProjectsPanel />
                  </div>)}
                {activeTab === 'expenses' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-expenses" aria-labelledby="time-tab-btn-expenses">
                    <ExpensesPanel managedExpenseAuthorId={managedScopeUserId}/>
                  </div>)}
                {activeTab === 'timesheet' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-timesheet" aria-labelledby="time-tab-btn-timesheet">
                    <div className="tsp-wrap">
                      <TimesheetPanel managedEntriesUserId={managedScopeUserId} managedEntriesUserRow={managedEntriesUserRow}/>
                    </div>
                  </div>)}
                {activeTab === 'reports' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-reports" aria-labelledby="time-tab-btn-reports">
                    <ReportsPanel />
                  </div>)}
                {activeTab === 'invoices' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-invoices" aria-labelledby="time-tab-btn-invoices">
                    <InvoicesPanel />
                  </div>)}
                {activeTab === 'settings' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-settings" aria-labelledby="time-tab-btn-settings">
                    <TimeTrackingSettingsPanel />
                  </div>)}
                {activeTab === 'clients' && (<div className="time-page__content time-page__content--enter" role="tabpanel" id="time-tab-clients" aria-labelledby="time-tab-btn-clients">
                    <div className="tt-settings">
                      <TimeTrackingClientsPanel />
                    </div>
                  </div>)}
              </>)}
      </main>
    </div>);
}
export default TimeTrackingPage;
