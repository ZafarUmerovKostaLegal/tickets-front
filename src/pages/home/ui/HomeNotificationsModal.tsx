import { memo } from 'react';
import { createPortal } from 'react-dom';
import type { NotificationItem } from '@entities/notification/wsClient';
const IconBell = memo(function IconBell() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>);
});
const IconPlus = memo(function IconPlus() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>);
});
type HomeNotificationsModalProps = {
    onClose: () => void;
    notifications: NotificationItem[];
    filteredNotifications: NotificationItem[];
    notificationsLoading: boolean;
    notificationsError: string | null;
    notificationSearch: string;
    setNotificationSearch: (v: string) => void;
    canManageNotifications: boolean;
    onAddClick: () => void;
    onNotificationSelect: (n: NotificationItem) => void;
};
export const HomeNotificationsModal = memo(function HomeNotificationsModal(props: HomeNotificationsModalProps) {
    const { onClose, notifications, filteredNotifications, notificationsLoading, notificationsError, notificationSearch, setNotificationSearch, canManageNotifications, onAddClick, onNotificationSelect, } = props;
    const handleItemClick = (n: NotificationItem) => {
        onNotificationSelect(n);
        onClose();
    };
    const modal = (<div className="hnm" role="dialog" aria-modal="true" aria-labelledby="hnm-title">
      <div className="hnm__backdrop" onClick={onClose} role="button" tabIndex={-1} aria-label="Закрыть"/>
      <div className="hnm__box" onClick={(e) => e.stopPropagation()}>
        <div className="hnm__head">
          <div className="hnm__head-left">
            <span className="hnm__icon"><IconBell /></span>
            <h2 id="hnm-title" className="hnm__title">Уведомления</h2>
            {notifications.length > 0 && (<span className="hnm__badge">{notifications.length}</span>)}
          </div>
          <div className="hnm__head-actions">
            {canManageNotifications && (<button type="button" className="hnm__add-btn" onClick={onAddClick} aria-label="Добавить объявление">
                <IconPlus />
              </button>)}
            <button type="button" className="hnm__close" onClick={onClose} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {notifications.length > 0 && (<div className="hnm__search-wrap">
            <input type="search" className="hnm__search" placeholder="Поиск..." value={notificationSearch} onChange={(e) => setNotificationSearch(e.target.value)} aria-label="Поиск уведомлений"/>
          </div>)}

        <div className="hnm__body">
          {notificationsError && (<div className="hnm__empty-state">
              <p className="hnm__empty-title">Ошибка загрузки</p>
              <p className="hnm__empty-desc">{notificationsError}</p>
            </div>)}
          {!notificationsError && notificationsLoading && (<div className="hnm__empty-state">
              <div className="hnm__skeleton hnm__skeleton--line"/>
              <div className="hnm__skeleton hnm__skeleton--line"/>
              <div className="hnm__skeleton hnm__skeleton--line"/>
            </div>)}
          {!notificationsError && !notificationsLoading && notifications.length === 0 && (<div className="hnm__empty-state">
              <span className="hnm__empty-icon hnm__bell-anim" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </svg>
              </span>
              <p className="hnm__empty-title">Всё спокойно</p>
              <p className="hnm__empty-desc">Новых уведомлений нет</p>
            </div>)}
          {!notificationsError && !notificationsLoading && notifications.length > 0 && filteredNotifications.length === 0 && (<p className="hnm__empty">Ничего не найдено</p>)}
          {!notificationsError && !notificationsLoading && filteredNotifications.length > 0 && (<ul className="hnm__items">
              {filteredNotifications.map((n) => (<li key={n.uuid} className="hnm__item" onClick={() => handleItemClick(n)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleItemClick(n)}>
                  <div className="hnm__item-main">
                    <h3 className="hnm__item-title">{n.title}</h3>
                    <p className="hnm__item-desc">{n.description || n.title}</p>
                  </div>
                  <span className="hnm__item-date">
                    {new Date(n.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </li>))}
            </ul>)}
        </div>
      </div>
    </div>);
    if (typeof document === 'undefined')
        return null;
    return createPortal(modal, document.body);
});
