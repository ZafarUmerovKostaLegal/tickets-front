import type { Ticket, StatusItem, PriorityItem } from '@entities/ticket';
import { AdminSelect } from './AdminSelect';
import { TicketCard } from './TicketCard';
type TicketsSectionProps = {
    tickets: Ticket[];
    ticketsLoading: boolean;
    ticketsError: string | null;
    ticketSearch: string;
    setTicketSearch: (v: string) => void;
    ticketStatusFilter: string;
    setTicketStatusFilter: (v: string) => void;
    ticketPriorityFilter: string;
    setTicketPriorityFilter: (v: string) => void;
    includeArchivedTickets: boolean;
    setIncludeArchivedTickets: (v: boolean) => void;
    statusOptions: StatusItem[];
    priorityOptions: PriorityItem[];
    loadTickets: () => Promise<void>;
    openTicketDetails: (t: Ticket) => Promise<void>;
};
export function TicketsSection(props: TicketsSectionProps) {
    const { tickets, ticketsLoading, ticketsError, ticketSearch, setTicketSearch, ticketStatusFilter, setTicketStatusFilter, ticketPriorityFilter, setTicketPriorityFilter, includeArchivedTickets, setIncludeArchivedTickets, statusOptions, priorityOptions, loadTickets, openTicketDetails, } = props;
    return (<section className="ap__card ap__card--tickets">
      <div className="ap__card-head">
        <h2 className="ap__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          Тикеты
        </h2>
        <span className="ap__card-count">{tickets.length}</span>
      </div>
      {ticketsError && (<div className="ap__alert ap__alert--error">
          <span>{ticketsError}</span>
          <button type="button" className="ap__alert-btn" onClick={loadTickets} disabled={ticketsLoading}>Повторить</button>
        </div>)}
      <div className="ap__toolbar">
        <div className="ap__search-wrap">
          <svg className="ap__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" className="ap__search" placeholder="Поиск по теме, описанию, категории..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}/>
        </div>
        <div className="ap__toolbar-right">
          <AdminSelect value={ticketStatusFilter} onChange={setTicketStatusFilter} options={[{ value: 'all', label: 'Все статусы' }, ...statusOptions.map((s) => ({ value: s.value, label: s.label }))]}/>
          <AdminSelect value={ticketPriorityFilter} onChange={setTicketPriorityFilter} options={[{ value: 'all', label: 'Все приоритеты' }, ...priorityOptions.map((p) => ({ value: p.value, label: p.label }))]}/>
          <label className="ap__switch-label">
            <span className="switch">
              <input type="checkbox" className="switch__input" checked={includeArchivedTickets} onChange={(e) => setIncludeArchivedTickets(e.target.checked)}/>
              <span className="switch__track"><span className="switch__thumb"/></span>
            </span>
            <span>Архивные</span>
          </label>
        </div>
      </div>
      <div className="ap__tickets-grid">
        {ticketsLoading && tickets.length === 0 && Array.from({ length: 4 }).map((_, idx) => (<div key={`ticket-skel-${idx}`} className="ap__ticket-card ap__ticket-card--skeleton">
            <div className="ap__ticket-card-header">
              <span className="ap__skel ap__skel--lg"/>
              <span className="ap__skel-pill"/>
            </div>
            <div className="ap__ticket-card-body">
              <div className="ap__ticket-card-row"><span className="ap__skel ap__skel--sm"/><span className="ap__skel ap__skel--md"/></div>
              <div className="ap__ticket-card-row"><span className="ap__skel ap__skel--sm"/><span className="ap__skel ap__skel--md"/></div>
            </div>
          </div>))}
        {!ticketsLoading && tickets.length === 0 && (<p className="ap__tickets-empty">Тикеты не найдены</p>)}
        {tickets.map((t) => (<TicketCard key={t.uuid} ticket={t} onOpenDetails={openTicketDetails}/>))}
      </div>
    </section>);
}
