import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode, } from 'react';
import { createTicket, getTickets, getStatuses, getPriorities, subscribeTicketsWsPush, connectTicketsWsWhenReady, type Ticket, type StatusItem, type PriorityItem, } from '@entities/ticket';
import { loadPublicUsersByIds, type User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { listNotifications, createNotification, subscribeNotificationPush, type NotificationItem, } from '@entities/notification/wsClient';
import { openNotificationAsRead } from '@entities/notification/readNotification';
import { useCurrentUser } from '@shared/hooks';
import { useI18n, formatDateShortLocalized, formatUserRef } from '@shared/i18n';
import { getPriorityTagClass, getStatusTagClass, ticketStatusBucketForStats, TICKET_CATEGORIES, isITRole, } from './constants';
import { coerceTicketFormPriority, resolveDefaultTicketPriority } from '@entities/ticket/lib/ticketPriority';
import { createCoalescedRequest } from '@shared/lib';
import type { TicketStats } from './types';
type HomeContextValue = {
    user: User | null;
    canCreateTicket: boolean;
    canManageNotifications: boolean;
    isITRole: boolean;
    tickets: Ticket[];
    statuses: StatusItem[];
    priorities: PriorityItem[];
    ticketsLoading: boolean;
    ticketsError: string | null;
    filterStatus: string;
    setFilterStatus: (v: string) => void;
    filterPriority: string;
    setFilterPriority: (v: string) => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    creatorNames: Record<number, string>;
    ticketStats: TicketStats;
    filteredTickets: Ticket[];
    loadTickets: () => Promise<void>;
    filterStatusOpen: boolean;
    setFilterStatusOpen: (v: boolean) => void;
    filterPriorityOpen: boolean;
    setFilterPriorityOpen: (v: boolean) => void;
    filterStatusRef: React.RefObject<HTMLDivElement | null>;
    filterPriorityRef: React.RefObject<HTMLDivElement | null>;
    showCreateForm: boolean;
    setShowCreateForm: (v: boolean) => void;
    createSubmitting: boolean;
    createError: string | null;
    setCreateError: (v: string | null) => void;
    createForm: {
        theme: string;
        description: string;
        category: string;
        priority: string;
    };
    setCreateForm: (v: {
        theme: string;
        description: string;
        category: string;
        priority: string;
    } | ((prev: {
        theme: string;
        description: string;
        category: string;
        priority: string;
    }) => {
        theme: string;
        description: string;
        category: string;
        priority: string;
    })) => void;
    createFile: File | null;
    setCreateFile: (v: File | null) => void;
    isDraggingFile: boolean;
    setIsDraggingFile: (v: boolean) => void;
    priorityDropdownOpen: boolean;
    setPriorityDropdownOpen: (v: boolean) => void;
    categoryDropdownOpen: boolean;
    setCategoryDropdownOpen: (v: boolean) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    priorityDropdownRef: React.RefObject<HTMLDivElement | null>;
    categoryDropdownRef: React.RefObject<HTMLDivElement | null>;
    handleCreateSubmit: (e: React.FormEvent) => Promise<void>;
    notifications: NotificationItem[];
    notificationsLoading: boolean;
    notificationsError: string | null;
    newNotificationTitle: string;
    setNewNotificationTitle: (v: string) => void;
    newNotificationDescription: string;
    setNewNotificationDescription: (v: string) => void;
    createNotificationLoading: boolean;
    createNotificationError: string | null;
    setCreateNotificationError: (v: string | null) => void;
    notificationSearch: string;
    setNotificationSearch: (v: string) => void;
    filteredNotifications: NotificationItem[];
    isCreateNotificationOpen: boolean;
    setIsCreateNotificationOpen: (v: boolean) => void;
    selectedNotification: NotificationItem | null;
    setSelectedNotification: (v: NotificationItem | null) => void;
    handleNotificationSelect: (notification: NotificationItem) => void;
    handleCreateNotification: (e: React.FormEvent) => Promise<void>;
    getPriorityTagClass: typeof getPriorityTagClass;
    getStatusTagClass: typeof getStatusTagClass;
    TICKET_CATEGORIES: typeof TICKET_CATEGORIES;
    formatDateShort: (iso: string) => string;
};
const HomeContext = createContext<HomeContextValue | null>(null);
export function useHome() {
    const ctx = useContext(HomeContext);
    if (!ctx)
        throw new Error('useHome must be used within HomeProvider');
    return ctx;
}
type HomeProviderProps = {
    children: ReactNode;
};
export function HomeProvider({ children }: HomeProviderProps) {
    const { user } = useCurrentUser();
    const { t, locale } = useI18n();
    const formatDateShort = useCallback((iso: string) => formatDateShortLocalized(iso, locale), [locale]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [priorities, setPriorities] = useState<PriorityItem[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketsError, setTicketsError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterPriority, setFilterPriority] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [creatorNames, setCreatorNames] = useState<Record<number, string>>({});
    const [filterStatusOpen, setFilterStatusOpen] = useState(false);
    const [filterPriorityOpen, setFilterPriorityOpen] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createForm, setCreateForm] = useState({ theme: '', description: '', category: 'Техника', priority: '' });
    const [createFile, setCreateFile] = useState<File | null>(null);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const priorityDropdownRef = useRef<HTMLDivElement>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const filterStatusRef = useRef<HTMLDivElement>(null);
    const filterPriorityRef = useRef<HTMLDivElement>(null);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState<string | null>(null);
    const [newNotificationTitle, setNewNotificationTitle] = useState('');
    const [newNotificationDescription, setNewNotificationDescription] = useState('');
    const [createNotificationLoading, setCreateNotificationLoading] = useState(false);
    const [createNotificationError, setCreateNotificationError] = useState<string | null>(null);
    const [notificationSearch, setNotificationSearch] = useState('');
    const [isCreateNotificationOpen, setIsCreateNotificationOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
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
    const ticketStats: TicketStats = useMemo(() => {
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
            const names: Record<number, string> = {};
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
            const out: Record<number, string> = {};
            for (const id of ids)
                out[id] = names[id] ?? formatUserRef(id, t);
            setCreatorNames(out);
        })();
        return () => {
            cancelled = true;
        };
    }, [tickets, t]);
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
    useEffect(() => {
        setNotificationsLoading(true);
        setNotificationsError(null);
        listNotifications({ skip: 0, limit: 10, include_archived: false })
            .then((list) => setNotifications(list))
            .catch((e: Error) => {
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
        const handleClickOutside = (e: MouseEvent) => {
            if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node))
                setPriorityDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [priorityDropdownOpen]);
    useEffect(() => {
        if (!categoryDropdownOpen)
            return;
        const handleClickOutside = (e: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node))
                setCategoryDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [categoryDropdownOpen]);
    useEffect(() => {
        if (!filterStatusOpen)
            return;
        const handleClickOutside = (e: MouseEvent) => {
            if (filterStatusRef.current && !filterStatusRef.current.contains(e.target as Node))
                setFilterStatusOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterStatusOpen]);
    useEffect(() => {
        if (!filterPriorityOpen)
            return;
        const handleClickOutside = (e: MouseEvent) => {
            if (filterPriorityRef.current && !filterPriorityRef.current.contains(e.target as Node))
                setFilterPriorityOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterPriorityOpen]);
    // Full list without status/priority — stats must stay stable when filters change.
    const fetchTicketsForHome = useCallback(async () => {
        const pageSize = 200;
        const all: Ticket[] = [];
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
        const onEscape = (e: KeyboardEvent) => {
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
    const handleCreateSubmit = useCallback(async (e: React.FormEvent) => {
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
    const value: HomeContextValue = useMemo(() => ({
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
    return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}
