import type { Dispatch, SetStateAction } from 'react';
import { archiveNotification, listNotifications, type NotificationItem } from './wsClient';

const LIST_PARAMS = { skip: 0, limit: 10, include_archived: false } as const;

export function openNotificationAsRead(
    notification: NotificationItem,
    setNotifications: Dispatch<SetStateAction<NotificationItem[]>>,
    setSelected: (notification: NotificationItem) => void,
): void {
    setSelected(notification);
    setNotifications((prev) => prev.filter((x) => x.uuid !== notification.uuid));
    void archiveNotification(notification.uuid).catch(() => {
        void listNotifications(LIST_PARAMS)
            .then(setNotifications)
            .catch(() => {  });
    });
}
