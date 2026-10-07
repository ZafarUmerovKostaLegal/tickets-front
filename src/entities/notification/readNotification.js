import { archiveNotification, listNotifications } from './wsClient';
const LIST_PARAMS = { skip: 0, limit: 10, include_archived: false };
export function openNotificationAsRead(notification, setNotifications, setSelected) {
    setSelected(notification);
    setNotifications((prev) => prev.filter((x) => x.uuid !== notification.uuid));
    void archiveNotification(notification.uuid).catch(() => {
        void listNotifications(LIST_PARAMS)
            .then(setNotifications)
            .catch(() => { });
    });
}
