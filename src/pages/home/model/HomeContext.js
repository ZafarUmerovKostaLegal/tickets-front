import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, } from 'react';
import { createTicket, getTickets, getStatuses, getPriorities, subscribeTicketsWsPush, connectTicketsWsWhenReady, } from '@entities/ticket';
import { loadPublicUsersByIds } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { listNotifications, createNotification, subscribeNotificationPush, } from '@entities/notification/wsClient';
import { openNotificationAsRead } from '@entities/notification/readNotification';
import { useCurrentUser } from '@shared/hooks';
import { useI18n, formatDateShortLocalized, formatUserRef } from '@shared/i18n';
import { getPriorityTagClass, getStatusTagClass, ticketStatusBucketForStats, TICKET_CATEGORIES, isITRole, } from './constants';
import { coerceTicketFormPriority, resolveDefaultTicketPriority } from '@entities/ticket/lib/ticketPriority';
import { createCoalescedRequest } from '@shared/lib';
const HomeContext = createContext(null);
export function useHome() {
    const ctx = useContext(HomeContext);
    if (!ctx)
        throw new Error('useHome must be used within HomeProvider');
    return ctx;
}
export function HomeProvider({ children }) {
    const { user } = useCurrentUser();
    const { t, locale } = useI18n();
    const formatDateShort = useCallback((iso) => formatDateShortLocalized(iso, locale), [locale]);
    const [tickets, setTickets] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketsError, setTicketsError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [creatorNames, setCreatorNames] = useState({});
    const [filterStatusOpen, setFilterStatusOpen] = useState(false);
    const [filterPriorityOpen, setFilterPriorityOpen] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [createForm, setCreateForm] = useState({ theme: '', description: '', category: 'Техника', priority: '' });
    const [createFile, setCreateFile] = useState(null);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const fileInputRef = useRef(null);
    const priorityDropdownRef = useRef(null);
    const categoryDropdownRef = useRef(null);
    const filterStatusRef = useRef(null);
    const filterPriorityRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState(null);
    const [newNotificationTitle, setNewNotificationTitle] = useState('');
    const [newNotificationDescription, setNewNotificationDescription] = useState('');
    const [createNotificationLoading, setCreateNotificationLoading] = useState(false);
    const [createNotificationError, setCreateNotificationError] = useState(null);
    const [notificationSearch, setNotificationSearch] = useState('');
    const [isCreateNotificationOpen, setIsCreateNotificationOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const isITRoleUser = isITRole(user?.role);
    const canCreateTicket = !isITRoleUser;
    const canManageNotifications = useMemo(() => {
        if (!user?.role)
            return false;
        const r = user.role.toLowerCase().replace(/\s+/g, ' ');
        if (r.includes('партнер') || r.includes('партнёр') || r.includes('partner'))
            return true;
        if (r.includes('it') || r.includes('айти'))
            return true;
        if (r.includes('офис') || r.includes('office'))
            return true;
        return false;
    }, [user?.role]);
    const ticketStats = useMemo(() => {
        const result = { open: 0, inProgress: 0, closed: 0, impossible: 0 };
        tickets.forEach((t) => {
            const bucket = ticketStatusBucketForStats(t.status, statuses);
            if (bucket === 'closed')
                result.closed += 1;
            else if (bucket === 'inProgress')
                result.inProgress += 1;
            else if (bucket === 'impossible')
                result.impossible += 1;
            else
                result.open += 1;
        });
        return result;
    }, [tickets, statuses]);
    const filteredNotifications = useMemo(() => {
        if (!notificationSearch.trim())
            return notifications;
        const q = notificationSearch.trim().toLowerCase();
        return notifications.filter((n) => n.title.toLowerCase().includes(q) ||
            (n.description && n.description.toLowerCase().includes(q)));
    }, [notifications, notificationSearch]);
    const filteredTickets = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return tickets.filter((t) => {
            if (filterStatus && t.status !== filterStatus)
                return false;
            if (filterPriority && t.priority !== filterPriority)
                return false;
            if (!q)
                return true;
            return t.theme.toLowerCase().includes(q) ||
                (t.description && t.description.toLowerCase().includes(q));
        });
    }, [tickets, searchQuery, filterStatus, filterPriority]);
    useEffect(() => {
        if (tickets.length === 0) {
            setCreatorNames({});
            return;
        }
        const ids = [...new Set(tickets.map((t) => t.created_by_user_id))];
        let cancelled = false;
        void (async () => {
            const names = {};
            try {
                const colleagues = await listColleaguesAsUsers();
                if (cancelled)
                    return;
                for (const u of colleagues) {
                    if (!u.id)
                        continue;
                    names[u.id] = u.display_name?.trim() || u.email?.trim() || t('ticketsPage.noName');
                }
            }
            catch {
            }
            const missing = ids.filter((id) => !names[id]);
            if (missing.length > 0) {
                const publicUsers = await loadPublicUsersByIds(missing);
                for (const id of missing) {
                    const u = publicUsers.get(id);
                    names[id] = u?.display_name?.trim() || u?.email?.trim() || formatUserRef(id, t);
                }
            }
            if (cancelled)
                return;
            const out = {};
            for (const id of ids)
                out[id] = names[id] ?? formatUserRef(id, t);
            setCreatorNames(out);
        })();
        return () => {
            cancelled = true;
        };
    }, [tickets, t]);
    const handleCreateNotification = useCallback(async (e) => {
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
    const handleNotificationSelect = useCallback((notification) => {
        openNotificationAsRead(notification, setNotifications, setSelectedNotification);
    }, []);
    useEffect(() => {
        setNotificationsLoading(true);
        setNotificationsError(null);
        listNotifications({ skip: 0, limit: 10, include_archived: false })
            .then((list) => setNotifications(list))
            .catch((e) => {
            setNotificationsError(e.message);
        })
            .finally(() => {
            setNotificationsLoading(false);
        });
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
    useEffect(() => {
        if (!priorityDropdownOpen)
            return;
        const handleClickOutside = (e) => {
            if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target))
                setPriorityDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [priorityDropdownOpen]);
    useEffect(() => {
        if (!categoryDropdownOpen)
            return;
        const handleClickOutside = (e) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target))
                setCategoryDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [categoryDropdownOpen]);
    useEffect(() => {
        if (!filterStatusOpen)
            return;
        const handleClickOutside = (e) => {
            if (filterStatusRef.current && !filterStatusRef.current.contains(e.target))
                setFilterStatusOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterStatusOpen]);
    useEffect(() => {
        if (!filterPriorityOpen)
            return;
        const handleClickOutside = (e) => {
            if (filterPriorityRef.current && !filterPriorityRef.current.contains(e.target))
                setFilterPriorityOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterPriorityOpen]);
    // Full list without status/priority — stats must stay stable when filters change.
    const fetchTicketsForHome = useCallback(async () => {
        const pageSize = 200;
        const all = [];
        let skip = 0;
        for (;;) {
            const batch = await getTickets({
                skip,
                limit: pageSize,
                include_archived: false,
            });
            all.push(...batch);
            if (batch.length < pageSize)
                break;
            skip += pageSize;
        }
        return all;
    }, []);
    const loadTickets = useCallback(async () => {
        setTicketsLoading(true);
        setTicketsError(null);
        try {
            const list = await fetchTicketsForHome();
            setTickets(list);
        }
        catch (e) {
            setTicketsError(e instanceof Error ? e.message : t('ticketsPage.errLoadTickets'));
        }
        finally {
            setTicketsLoading(false);
        }
    }, [fetchTicketsForHome, t]);
    useEffect(() => {
        if (!showCreateForm)
            return;
        document.body.style.overflow = 'hidden';
        const onEscape = (e) => {
            if (e.key === 'Escape')
                setShowCreateForm(false);
        };
        window.addEventListener('keydown', onEscape);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onEscape);
        };
    }, [showCreateForm]);
    useEffect(() => {
        getStatuses().then(setStatuses).catch(() => { });
        getPriorities().then((list) => {
            setPriorities(list);
            setCreateForm((f) => ({
                ...f,
                priority: f.priority ? coerceTicketFormPriority(f.priority, list) : resolveDefaultTicketPriority(list),
            }));
        }).catch(() => { });
    }, []);
    useEffect(() => {
        loadTickets();
    }, [loadTickets]);
    useEffect(() => {
        if (!user)
            return;
        connectTicketsWsWhenReady().catch(() => { });
    }, [user]);
    useEffect(() => {
        let live = true;
        const refresh = createCoalescedRequest(async () => {
            const list = await fetchTicketsForHome();
            if (live)
                setTickets(list);
        }, 120);
        const off = subscribeTicketsWsPush((msg) => {
            const evRaw = msg.event ?? msg.type;
            const ev = typeof evRaw === 'string' ? evRaw : '';
            if (!(ev.startsWith('ticket_') || ev.startsWith('comment_')))
                return;
            refresh.schedule();
        });
        return () => {
            live = false;
            refresh.cancel();
            off();
        };
    }, [fetchTicketsForHome]);
    const handleCreateSubmit = useCallback(async (e) => {
        e.preventDefault();
        setCreateSubmitting(true);
        setCreateError(null);
        try {
            const created = await createTicket({
                theme: createForm.theme.trim(),
                description: createForm.description.trim(),
                category: createForm.category || 'Общее',
                priority: createForm.priority || resolveDefaultTicketPriority(priorities),
                attachment: createFile || undefined,
            });
            setCreateForm({
                theme: '',
                description: '',
                category: 'Техника',
                priority: resolveDefaultTicketPriority(priorities),
            });
            setCreateFile(null);
            setShowCreateForm(false);
            try {
                const list = await fetchTicketsForHome();
                const merged = list.some((t) => t.uuid === created.uuid) ? list : [created, ...list];
                setTickets(merged);
            }
            catch {
                setTickets((prev) => (prev.some((t) => t.uuid === created.uuid) ? prev : [created, ...prev]));
            }
        }
        catch (err) {
            setCreateError(err instanceof Error ? err.message : t('ticketsPage.errCreateTicket'));
        }
        finally {
            setCreateSubmitting(false);
        }
    }, [createForm, createFile, fetchTicketsForHome, priorities, t]);
    const value = useMemo(() => ({
        user,
        canCreateTicket,
        canManageNotifications,
        isITRole: isITRoleUser,
        tickets,
        statuses,
        priorities,
        ticketsLoading,
        ticketsError,
        filterStatus,
        setFilterStatus,
        filterPriority,
        setFilterPriority,
        searchQuery,
        setSearchQuery,
        creatorNames,
        ticketStats,
        filteredTickets,
        loadTickets,
        filterStatusOpen,
        setFilterStatusOpen,
        filterPriorityOpen,
        setFilterPriorityOpen,
        filterStatusRef,
        filterPriorityRef,
        showCreateForm,
        setShowCreateForm,
        createSubmitting,
        createError,
        setCreateError,
        createForm,
        setCreateForm,
        createFile,
        setCreateFile,
        isDraggingFile,
        setIsDraggingFile,
        priorityDropdownOpen,
        setPriorityDropdownOpen,
        categoryDropdownOpen,
        setCategoryDropdownOpen,
        fileInputRef,
        priorityDropdownRef,
        categoryDropdownRef,
        handleCreateSubmit,
        notifications,
        notificationsLoading,
        notificationsError,
        newNotificationTitle,
        setNewNotificationTitle,
        newNotificationDescription,
        setNewNotificationDescription,
        createNotificationLoading,
        createNotificationError,
        setCreateNotificationError,
        notificationSearch,
        setNotificationSearch,
        filteredNotifications,
        isCreateNotificationOpen,
        setIsCreateNotificationOpen,
        selectedNotification,
        setSelectedNotification,
        handleNotificationSelect,
        handleCreateNotification,
        getPriorityTagClass,
        getStatusTagClass,
        TICKET_CATEGORIES,
        formatDateShort,
    }), [
        user,
        canCreateTicket,
        canManageNotifications,
        isITRoleUser,
        tickets,
        statuses,
        priorities,
        ticketsLoading,
        ticketsError,
        filterStatus,
        filterPriority,
        searchQuery,
        creatorNames,
        ticketStats,
        filteredTickets,
        loadTickets,
        filterStatusOpen,
        filterPriorityOpen,
        showCreateForm,
        createSubmitting,
        createError,
        createForm,
        createFile,
        isDraggingFile,
        priorityDropdownOpen,
        categoryDropdownOpen,
        handleCreateSubmit,
        notifications,
        notificationsLoading,
        notificationsError,
        newNotificationTitle,
        newNotificationDescription,
        createNotificationLoading,
        createNotificationError,
        notificationSearch,
        filteredNotifications,
        isCreateNotificationOpen,
        selectedNotification,
        handleNotificationSelect,
        handleCreateNotification,
        formatDateShort,
    ]);
    return _jsx(HomeContext.Provider, { value: value, children: children });
}
