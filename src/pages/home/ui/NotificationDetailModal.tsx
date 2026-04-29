import { memo } from 'react';
import type { NotificationItem } from '@entities/notification/wsClient';
import { AuthImg } from '@shared/ui';
type NotificationDetailModalProps = {
    notification: NotificationItem;
    onClose: () => void;
};
export const NotificationDetailModal = memo(function NotificationDetailModal({ notification, onClose }: NotificationDetailModalProps) {
    return (<div className="tm" role="dialog" aria-modal="true">
      <div className="tm__backdrop" onClick={onClose} role="button" tabIndex={-1} aria-label="Закрыть"/>
      <div className="tm__box" onClick={(e) => e.stopPropagation()}>
        <div className="tm__head">
          <div className="tm__head-left">
            <span className="tm__head-icon tm__head-icon--bell">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <h2 className="tm__title">Уведомление</h2>
          </div>
          <button type="button" className="tm__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="tm__body">
          <h3 className="tm__body-title">{notification.title}</h3>
          <div className="tm__body-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>{new Date(notification.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            <span className="tm__body-dot"/>
            <span>{new Date(notification.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="tm__body-text">{notification.description || notification.title}</div>
          {notification.photo_path && (<div className="tm__body-photo">
              <AuthImg mediaPath={notification.photo_path} alt="" className="tm__body-img"/>
            </div>)}
        </div>
        <div className="tm__foot">
          <button type="button" className="tm__btn tm__btn--ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>);
});
