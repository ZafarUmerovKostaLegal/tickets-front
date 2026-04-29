import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedLink } from '@shared/ui';
import { getTicketDetailUrl } from '@shared/config';
import type { Ticket } from '@entities/ticket';
import type { StatusItem, PriorityItem } from '@entities/ticket';
const IconCheck = memo(function IconCheck() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>);
});
const IconWarning = memo(function IconWarning() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>);
});
const IconInfo = memo(function IconInfo() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>);
});
type HomeTicketsSectionProps = {
    isITRole: boolean;
    tickets: Ticket[];
    filteredTickets: Ticket[];
    ticketsLoading: boolean;
    ticketsError: string | null;
    statuses: StatusItem[];
    priorities: PriorityItem[];
    filterStatus: string;
    setFilterStatus: (v: string) => void;
    filterPriority: string;
    setFilterPriority: (v: string) => void;
    filterStatusOpen: boolean;
    setFilterStatusOpen: (v: boolean) => void;
    filterPriorityOpen: boolean;
    setFilterPriorityOpen: (v: boolean) => void;
    filterStatusRef: React.RefObject<HTMLDivElement | null>;
    filterPriorityRef: React.RefObject<HTMLDivElement | null>;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    creatorNames: Record<number, string>;
    getStatusTagClass: (status: string) => string;
    getPriorityTagClass: (priority: string) => string;
    formatDateShort: (date: string) => string;
    loadTickets: () => Promise<void>;
    canCreateTicket: boolean;
    onOpenCreateForm: () => void;
};
export const HomeTicketsSection = memo(function HomeTicketsSection(props: HomeTicketsSectionProps) {
    const { isITRole, tickets, filteredTickets, ticketsLoading, ticketsError, statuses, priorities, filterStatus, setFilterStatus, filterPriority, setFilterPriority, filterStatusOpen, setFilterStatusOpen, filterPriorityOpen, setFilterPriorityOpen, filterStatusRef, filterPriorityRef, searchQuery, setSearchQuery, creatorNames, getStatusTagClass, getPriorityTagClass, formatDateShort, loadTickets, canCreateTicket, } = props;
    const [isFilterTransition, setIsFilterTransition] = useState(false);
    const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstRenderRef = useRef(true);
    useEffect(() => {
        if (firstRenderRef.current) {
            firstRenderRef.current = false;
            return;
        }
        if (ticketsLoading || !!ticketsError || tickets.length === 0)
            return;
        setIsFilterTransition(true);
        if (transitionTimerRef.current)
            clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = setTimeout(() => {
            setIsFilterTransition(false);
            transitionTimerRef.current = null;
        }, 180);
        return () => {
            if (transitionTimerRef.current) {
                clearTimeout(transitionTimerRef.current);
                transitionTimerRef.current = null;
            }
        };
    }, [filterStatus, filterPriority, searchQuery, ticketsLoading, ticketsError, tickets.length]);
    const viewState = useMemo(() => {
        if (isFilterTransition)
            return 'loading';
        if (ticketsError)
            return 'error';
        if (ticketsLoading)
            return 'loading';
        if (tickets.length === 0)
            return 'empty';
        if (filteredTickets.length === 0)
            return 'not-found';
        return 'table';
    }, [isFilterTransition, ticketsError, ticketsLoading, tickets.length, filteredTickets.length]);
    const contentKey = `${viewState}|${filterStatus}|${filterPriority}|${searchQuery}`;
    return (<section className="home-tickets">
      <div className="home-tickets__card">
        <div className="home-tickets__toolbar">
          <h2 className="home-tickets__title">
            <span className="home-tickets__title-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </span>
            {isITRole ? 'Заявки пользователей' : 'Мои заявки'}
          </h2>
          <div className="home-tickets__toolbar-actions">
            <div className="home-tickets__filters-row">
              <div className="home-tickets__filter" ref={filterStatusRef}>
                <button type="button" className={`home-tickets__filter-trigger ${filterStatusOpen ? 'home-tickets__filter-trigger--open' : ''}`} onClick={() => { setFilterStatusOpen(!filterStatusOpen); setFilterPriorityOpen(false); }} aria-haspopup="listbox" aria-expanded={filterStatusOpen}>
                  <span className="home-tickets__filter-value">
                    {filterStatus ? statuses.find((s) => s.value === filterStatus)?.label ?? filterStatus : 'Статус'}
                  </span>
                  <span className="home-tickets__filter-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </span>
                </button>
                <div className={`home-tickets__filter-dropdown ${filterStatusOpen ? 'home-tickets__filter-dropdown--open' : ''}`} role="listbox">
                  <button type="button" role="option" aria-selected={!filterStatus} className={`home-tickets__filter-option ${!filterStatus ? 'home-tickets__filter-option--selected' : ''}`} onClick={() => { setFilterStatus(''); setFilterStatusOpen(false); }}>Все статусы</button>
                  {statuses.map((s) => (<button key={s.value} type="button" role="option" aria-selected={filterStatus === s.value} className={`home-tickets__filter-option ${filterStatus === s.value ? 'home-tickets__filter-option--selected' : ''}`} onClick={() => { setFilterStatus(s.value); setFilterStatusOpen(false); }}>{s.label}</button>))}
                </div>
              </div>
              <div className="home-tickets__filter" ref={filterPriorityRef}>
                <button type="button" className={`home-tickets__filter-trigger ${filterPriorityOpen ? 'home-tickets__filter-trigger--open' : ''}`} onClick={() => { setFilterPriorityOpen(!filterPriorityOpen); setFilterStatusOpen(false); }} aria-haspopup="listbox" aria-expanded={filterPriorityOpen}>
                  <span className="home-tickets__filter-value">
                    {filterPriority ? priorities.find((p) => p.value === filterPriority)?.label ?? filterPriority : 'Приоритет'}
                  </span>
                  <span className="home-tickets__filter-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </span>
                </button>
                <div className={`home-tickets__filter-dropdown ${filterPriorityOpen ? 'home-tickets__filter-dropdown--open' : ''}`} role="listbox">
                  <button type="button" role="option" aria-selected={!filterPriority} className={`home-tickets__filter-option ${!filterPriority ? 'home-tickets__filter-option--selected' : ''}`} onClick={() => { setFilterPriority(''); setFilterPriorityOpen(false); }}>Все приоритеты</button>
                  {priorities.map((p) => (<button key={p.value} type="button" role="option" aria-selected={filterPriority === p.value} className={`home-tickets__filter-option ${filterPriority === p.value ? 'home-tickets__filter-option--selected' : ''}`} onClick={() => { setFilterPriority(p.value); setFilterPriorityOpen(false); }}>{p.label}</button>))}
                </div>
              </div>
              {(filterStatus || filterPriority) && (<button type="button" className="home-tickets__btn-reset-filters" onClick={() => { setFilterStatus(''); setFilterPriority(''); }}>Сбросить</button>)}
            </div>
            {!ticketsError && !ticketsLoading && tickets.length > 0 && (<div className="home-tickets__search-wrap">
                <span className="home-tickets__search-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </span>
                <input type="search" className="home-tickets__search" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Поиск заявок"/>
              </div>)}
          </div>
        </div>

        <div className="home-tickets__body">
          {viewState === 'error' && (<div className="home-tickets__state home-tickets__state--error">
              <span className="home-tickets__state-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              <p className="home-tickets__state-title">Не удалось загрузить</p>
              <p className="home-tickets__state-desc">{ticketsError}</p>
              <button type="button" className="home-tickets__btn-retry" onClick={() => loadTickets()}>Повторить</button>
            </div>)}
          {viewState === 'loading' && (<div className="home-tickets__state home-tickets__state--loading">
              <div className="home-tickets__skeleton home-tickets__skeleton--head"/>
              <div className="home-tickets__skeleton home-tickets__skeleton--line"/>
              <div className="home-tickets__skeleton home-tickets__skeleton--line"/>
              <div className="home-tickets__skeleton home-tickets__skeleton--line"/>
            </div>)}
          {viewState === 'empty' && (<div className="home-tickets__state home-tickets__state--empty">
              <span className="home-tickets__state-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <p className="home-tickets__state-title">Заявок пока нет</p>
              <p className="home-tickets__state-desc">{canCreateTicket ? 'Создайте первую заявку' : 'У вас пока нет заявок'}</p>
            </div>)}
          {viewState === 'not-found' && (<div className="home-tickets__state home-tickets__state--empty">
              <p className="home-tickets__state-title">Ничего не найдено</p>
              <p className="home-tickets__state-desc">Попробуйте изменить запрос</p>
            </div>)}
          {viewState === 'table' && (<div key={contentKey} className="home-tickets__table home-tickets__table--animated">
              <div className="home-tickets__table-head">
                <span className="home-tickets__th home-tickets__th--theme">Заявка</span>
                <span className="home-tickets__th home-tickets__th--author">Автор</span>
                <span className="home-tickets__th home-tickets__th--priority">Приоритет</span>
                <span className="home-tickets__th home-tickets__th--status">Статус</span>
                <span className="home-tickets__th home-tickets__th--date">Дата</span>
              </div>
              {filteredTickets.map((t) => {
                const statusClass = getStatusTagClass(t.status);
                const priorityLabel = priorities.find((p) => p.value === t.priority)?.label ?? t.priority;
                const iconEl = statusClass === 'closed' ? <IconCheck /> :
                    statusClass === 'impossible' ? <IconWarning /> :
                        <IconInfo />;
                return (<AnimatedLink key={t.uuid} to={getTicketDetailUrl(t.uuid)} className={`home-tickets__row home-tickets__row--${statusClass}`}>
                    <span className="home-tickets__td home-tickets__td--theme">
                      <span className={`home-tickets__row-icon home-tickets__row-icon--${statusClass}`}>{iconEl}</span>
                      <span className="home-tickets__row-title">{t.theme}</span>
                    </span>
                    <span className="home-tickets__td home-tickets__td--author">{creatorNames[t.created_by_user_id] ?? '—'}</span>
                    <span className="home-tickets__td home-tickets__td--priority">
                      <span className={`home-tickets__priority-wrap ${getPriorityTagClass(t.priority)}`} aria-label={priorityLabel}>
                        <span className="home-tickets__priority-dot" aria-hidden/>
                        <span className="home-tickets__priority-tooltip">{priorityLabel}</span>
                      </span>
                    </span>
                    <span className="home-tickets__td home-tickets__td--status">
                      <span className={`home-tickets__status-dot home-tickets__status-dot--${statusClass}`}/>
                      <span className="home-tickets__status-text">{statuses.find((s) => s.value === t.status)?.label ?? t.status}</span>
                    </span>
                    <span className="home-tickets__td home-tickets__td--date">{formatDateShort(t.created_at)}</span>
                  </AnimatedLink>);
            })}
            </div>)}
        </div>
      </div>
    </section>);
});
