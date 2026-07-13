import { formatDateOnly } from '@shared/lib/formatDate';
import type { Ticket } from '@entities/ticket';
type TicketCardProps = {
    ticket: Ticket;
    onOpenDetails: (t: Ticket) => void;
};
function getStatusKey(status: string): 'open' | 'done' | 'cancel' {
    const lower = status.toLowerCase();
    if (lower.includes('закрыт') || lower.includes('решен'))
        return 'done';
    if (lower.includes('невозможно') || lower.includes('отклон') || lower.includes('отмен'))
        return 'cancel';
    return 'open';
}
export function TicketCard({ ticket, onOpenDetails }: TicketCardProps) {
    const sKey = getStatusKey(ticket.status);
    return (<article className={`ap__ticket-card ap__ticket-card--${sKey}`}>
      <div className="ap__ticket-card-header">
        <button type="button" className="ap__ticket-card-theme" onClick={() => onOpenDetails(ticket)}>
          {ticket.theme}
        </button>
        <span className={`ap__pill ap__pill--${sKey}`}>{ticket.status}</span>
      </div>
      <div className="ap__ticket-card-body">
        <div className="ap__ticket-card-row">
          <span className="ap__ticket-card-lbl">Категория</span>
          <span>{ticket.category}</span>
        </div>
        <div className="ap__ticket-card-row">
          <span className="ap__ticket-card-lbl">Приоритет</span>
          <span>{ticket.priority}</span>
        </div>
      </div>
      <div className="ap__ticket-card-meta">
        {formatDateOnly(ticket.created_at)}
      </div>
    </article>);
}
