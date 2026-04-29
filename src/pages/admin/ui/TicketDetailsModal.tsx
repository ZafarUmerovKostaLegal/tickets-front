import { AnimatedLink } from '@shared/ui';
import { getTicketDetailUrl } from '@shared/config';
import type { Ticket } from '@entities/ticket';
type TicketDetailsModalProps = {
    ticket: Ticket;
    loading: boolean;
    error: string | null;
    onClose: () => void;
};
export function TicketDetailsModal({ ticket, loading, error, onClose }: TicketDetailsModalProps) {
    return (<div className="ap__overlay">
      <div className="ap__modal" onClick={(e) => e.stopPropagation()}>
        <div className="ap__modal-head">
          <h3 className="ap__modal-title">Детали тикета</h3>
          <button type="button" className="ap__modal-close" aria-label="Закрыть" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {error && <p className="ap__inline-error">{error}</p>}
        {loading ? (<div className="ap__modal-body ap__modal-body--skeleton">
            <div className="ap__modal-row"><span className="ap__skel ap__skel--lg"/></div>
            <div className="ap__modal-row"><span className="ap__skel ap__skel--md"/></div>
            <div className="ap__modal-row"><span className="ap__skel ap__skel--md"/></div>
            <div className="ap__modal-row"><span className="ap__skel ap__skel--sm"/></div>
          </div>) : (<div className="ap__modal-body">
            <div className="ap__modal-row"><span className="ap__modal-lbl">Тема</span><span className="ap__modal-val">{ticket.theme}</span></div>
            <div className="ap__modal-row"><span className="ap__modal-lbl">Категория</span><span className="ap__modal-val">{ticket.category}</span></div>
            <div className="ap__modal-row"><span className="ap__modal-lbl">Приоритет</span><span className="ap__modal-val">{ticket.priority}</span></div>
            <div className="ap__modal-row"><span className="ap__modal-lbl">Статус</span><span className="ap__modal-val">{ticket.status}</span></div>
            <div className="ap__modal-row"><span className="ap__modal-lbl">Создан</span><span className="ap__modal-val">{new Date(ticket.created_at).toLocaleString('ru-RU')}</span></div>
            {ticket.description && (<div className="ap__modal-row ap__modal-row--col">
                <span className="ap__modal-lbl">Описание</span>
                <p className="ap__modal-desc">{ticket.description}</p>
              </div>)}
          </div>)}
        <div className="ap__modal-foot">
          <button type="button" className="ap__btn ap__btn--ghost" onClick={onClose}>Закрыть</button>
          <AnimatedLink to={getTicketDetailUrl(ticket.uuid)} className="ap__btn ap__btn--primary" onClick={onClose}>Открыть на странице</AnimatedLink>
        </div>
      </div>
    </div>);
}
