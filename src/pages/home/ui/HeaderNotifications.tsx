import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    listNotifications,
    createNotification,
    subscribeNotificationPush,
    type NotificationItem,
} from '@entities/notification/wsClient';
import { openNotificationAsRead } from '@entities/notification/readNotification';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { HomeNotificationsModal } from './HomeNotificationsModal';
import { NotificationDetailModal } from './NotificationDetailModal';
import { CreateNotificationModal } from './CreateNotificationModal';

const IconBell = memo(function IconBell() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    );
});

function canManageNotificationsRole(role: string | undefined): boolean {
    if (!role)
        return false;
    const r = role.toLowerCase().replace(/\s+/g, ' ');
    if (r.includes('партнер') || r.includes('партнёр') || r.includes('partner'))
        return true;
    if (r.includes('it') || r.includes('айти'))
        return true;
    if (r.includes('офис') || r.includes('office'))
        return true;
    return false;
}

export function HeaderNotifications() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const canManageNotifications = useMemo(() => canManageNotificationsRole(user?.role), [user?.role]);

    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState<string | null>(null);
    const [notificationSearch, setNotificationSearch] = useState('');
    const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
    const [isCreateNotificationOpen, setIsCreateNotificationOpen] = useState(false);
    const [newNotificationTitle, setNewNotificationTitle] = useState('');
    const [newNotificationDescription, setNewNotificationDescription] = useState('');
    const [createNotificationLoading, setCreateNotificationLoading] = useState(false);
    const [createNotificationError, setCreateNotificationError] = useState<string | null>(null);

    const filteredNotifications = useMemo(() => {
        if (!notificationSearch.trim())
            return notifications;
        const q = notificationSearch.trim().toLowerCase();
        return notifications.filter((n) => n.title.toLowerCase().includes(q)
            || (n.description && n.description.toLowerCase().includes(q)));
    }, [notifications, notificationSearch]);

    useEffect(() => {
        setNotificationsLoading(true);
        setNotificationsError(null);
        listNotifications({ skip: 0, limit: 10, include_archived: false })
            .then((list) => setNotifications(list))
            .catch((e: Error) => setNotificationsError(e.message))
            .finally(() => setNotificationsLoading(false));
    }, []);

    useEffect(() => {
        return subscribeNotificationPush((n) => {
            setNotifications((prev) => {
                if (prev.some((x) => x.uuid === n.uuid))
                    return prev;
                return [n, ...prev];
            });
        });
    }, []);

    const handleOpenCreateNotification = useCallback(() => {
        setNewNotificationTitle('');
        setNewNotificationDescription('');
        setCreateNotificationError(null);
        setIsCreateNotificationOpen(true);
        setNotificationsOpen(false);
    }, []);

    const handleCreateNotification = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNotificationTitle.trim() || !newNotificationDescription.trim() || createNotificationLoading)
            return;
        setCreateNotificationLoading(true);
        setCreateNotificationError(null);
        try {
            const created = await createNotification({
                title: newNotificationTitle.trim(),
                description: newNotificationDescription.trim(),
            });
            setNotifications((prev) => [created, ...prev]);
            setNewNotificationTitle('');
            setNewNotificationDescription('');
            setIsCreateNotificationOpen(false);
        }
        catch (err) {
            setCreateNotificationError(err instanceof Error ? err.message : 'Не удалось создать объявление');
        }
        finally {
            setCreateNotificationLoading(false);
        }
    }, [newNotificationTitle, newNotificationDescription, createNotificationLoading]);

    const handleNotificationSelect = useCallback((notification: NotificationItem) => {
        openNotificationAsRead(notification, setNotifications, setSelectedNotification);
    }, []);

    return (
        <>
            <button
                type="button"
                className={`app-header-action app-header-action--icon app-header-action--notifications${notificationsOpen ? ' app-header-action--active' : ''}`}
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label={notificationsOpen ? t('ticketsPage.hideNotifications') : t('ticketsPage.showNotifications')}
                aria-expanded={notificationsOpen}
            >
                <span className="app-header-action__icon">
                    <IconBell />
                </span>
                {notifications.length > 0 && (
                    <span className="app-header-action__badge">{notifications.length}</span>
                )}
            </button>

            {notificationsOpen && (
                <HomeNotificationsModal
                    onClose={() => setNotificationsOpen(false)}
                    notifications={notifications}
                    filteredNotifications={filteredNotifications}
                    notificationsLoading={notificationsLoading}
                    notificationsError={notificationsError}
                    notificationSearch={notificationSearch}
                    setNotificationSearch={setNotificationSearch}
                    canManageNotifications={canManageNotifications}
                    onAddClick={handleOpenCreateNotification}
                    onNotificationSelect={handleNotificationSelect}
                />
            )}

            {selectedNotification && (
                <NotificationDetailModal
                    notification={selectedNotification}
                    onClose={() => setSelectedNotification(null)}
                />
            )}

            {canManageNotifications && isCreateNotificationOpen && (
                <CreateNotificationModal
                    onClose={() => setIsCreateNotificationOpen(false)}
                    onSubmit={handleCreateNotification}
                    title={newNotificationTitle}
                    description={newNotificationDescription}
                    onTitleChange={setNewNotificationTitle}
                    onDescriptionChange={setNewNotificationDescription}
                    loading={createNotificationLoading}
                    error={createNotificationError}
                />
            )}
        </>
    );
}
