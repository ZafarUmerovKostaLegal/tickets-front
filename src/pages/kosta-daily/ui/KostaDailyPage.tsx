import { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { AppBackButton, AppPageSettings, TwemojiEmoji, useAppDialog } from '@shared/ui';
import { useCurrentUser, useDebouncedValue, useMediaQuery } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { listContactsColleagues } from '@entities/contacts';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import { formatReplyPreview, setChatNotificationContext, type ChatPreview, type DailyMessage, type RenderBlock } from '@entities/chat';
import { useKostaDailyChat } from '../model/useKostaDailyChat';
import {
    KostaDailyChatListSkeleton,
    KostaDailyChatPaneSkeleton,
    KostaDailyMembersSkeleton,
} from './KostaDailySkeleton';
import { KostaDailyComposer } from './KostaDailyComposer';
import type { ComposerPickerTab } from './KostaDailyComposerPicker';
import { KostaDailyCreateRoomModal, type CreateRoomKind } from './KostaDailyCreateRoomModal';
import { KostaDailyPollComposerModal } from './KostaDailyPollComposerModal';
import { KostaDailyRoomMembersModal } from './KostaDailyRoomMembersModal';
import { KostaDailyVirtualFeed, type KostaDailyVirtualFeedHandle } from './KostaDailyVirtualFeed';
import { KostaDailyVirtualChatList, type KostaDailyChatListItem } from './KostaDailyVirtualChatList';
import { KostaDailyVirtualEmployeesList, type KostaDailyEmployeeListItem } from './KostaDailyVirtualEmployeesList';
import { KostaDailyFeedBlock } from './KostaDailyFeedBlock';
import { avatarColor, initials } from './kostaDailyAvatar';
import { dailyMessageMatchesSearch } from './kostaDailySearchHighlight';
import { REACTION_EMOJIS } from './kostaDailyReactions';
import './KostaDailyPage.css';

type SidebarView = 'chats' | 'members';

const MOBILE_LAYOUT_MQ = '(max-width: 860px)';
const CHAT_BOTTOM_PIN_THRESHOLD_PX = 96;
const CHAT_LOAD_OLDER_THRESHOLD_PX = 120;

function IconSeal() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M12 2L4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    );
}

function IconGroupPeople() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden>
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
    );
}

function chatListAvatar(chat: ChatPreview): ReactNode {
    if (chat.isCompanyChannel)
        return <IconGroupPeople />;
    if (chat.isChannel)
        return '📢';
    if (chat.isGroup)
        return <IconGroupPeople />;
    return initials(chat.title);
}

function employeeLabel(u: TimeTrackingUserRow): string {
    const n = u.display_name?.trim();
    if (n)
        return n;
    return u.email?.trim() || `Пользователь ${u.id}`;
}

function employeeSearchText(u: TimeTrackingUserRow): string {
    return [u.display_name, u.email, u.position, u.role, String(u.id)].filter(Boolean).join(' ');
}

function mergeEmployeeDirectory(rows: TimeTrackingUserRow[]): TimeTrackingUserRow[] {
    const byId = new Map<number, TimeTrackingUserRow>();
    for (const u of rows) {
        if (u.is_archived || u.is_blocked)
            continue;
        if (isHiddenSystemUser(u))
            continue;
        byId.set(u.id, u);
    }
    return [...byId.values()].sort((a, b) => employeeLabel(a).localeCompare(employeeLabel(b), 'ru', { sensitivity: 'base' }));
}

function IconSearch() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    );
}

function IconMenu() {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </svg>
    );
}

function IconBack() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    );
}

function IconChevronUp() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m18 15-6-6-6 6" />
      </svg>
    );
}

function IconChevronDown() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
}

export function KostaDailyPage() {
    const { user } = useCurrentUser();
    const [searchParams, setSearchParams] = useSearchParams();
    const isMobile = useMediaQuery(MOBILE_LAYOUT_MQ);
    const feedRef = useRef<HTMLDivElement>(null);
    const messagesInnerRef = useRef<HTMLDivElement>(null);
    const virtualFeedRef = useRef<KostaDailyVirtualFeedHandle>(null);
    const pinnedToBottomRef = useRef(true);
    const loadingOlderScrollRef = useRef(false);
    const chatSearchInputRef = useRef<HTMLInputElement>(null);
    const chatListRef = useRef<HTMLUListElement>(null);
    const membersListRef = useRef<HTMLUListElement>(null);
    const [chatSearchOpen, setChatSearchOpen] = useState(false);
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [chatSearchIndex, setChatSearchIndex] = useState(0);
    const [sidebarView, setSidebarView] = useState<SidebarView>('chats');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [draft, setDraft] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTab, setPickerTab] = useState<ComposerPickerTab>('emoji');
    const [employees, setEmployees] = useState<TimeTrackingUserRow[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(true);
    const [employeesError, setEmployeesError] = useState<string | null>(null);
    const [openingDmUserId, setOpeningDmUserId] = useState<number | null>(null);
    const [replyTo, setReplyTo] = useState<{
        messageId: number;
        authorName: string;
        preview: string;
    } | null>(null);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
    const [replyFlashId, setReplyFlashId] = useState<string | null>(null);
    const [createRoomKind, setCreateRoomKind] = useState<CreateRoomKind | null>(null);
    const [pollModalOpen, setPollModalOpen] = useState(false);
    const [roomMembersOpen, setRoomMembersOpen] = useState(false);
    const [ctxMenu, setCtxMenu] = useState<{
        msg: DailyMessage;
        own: boolean;
        x: number;
        y: number;
    } | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const longPressTimerRef = useRef<number | null>(null);

    const {
        roomsLoading,
        roomsError,
        messagesError,
        messagesLoading,
        loadingOlder,
        hasMoreOlder,
        loadOlderMessages,
        sendError,
        initialPaneLoading,
        chatPreviews,
        activeRoomId,
        activePreview,
        activeRoom,
        blocks,
        unreadByChat,
        memberCountLabel,
        selectRoom,
        prefetchRoomMessages,
        sendMessage,
        sendFile,
        sending,
        openDmWithUser,
        toggleReaction,
        deleteMessage,
        createGroupRoom,
        createChannelRoom,
        createPoll,
        votePoll,
        closePoll,
        canPost,
    } = useKostaDailyChat(user?.id, employees);

    const { showConfirm } = useAppDialog();

    const activeChatId = activeRoomId != null ? String(activeRoomId) : '';
    const activeChat: ChatPreview = activePreview ?? {
        id: activeChatId || '0',
        roomId: activeRoomId ?? 0,
        title: 'Kosta Daily',
        subtitle: '',
        lastMessage: '',
        time: '',
        isGroup: true,
        roomType: 'company',
    };

    const debouncedChatSearchQuery = useDebouncedValue(chatSearchQuery, 250);

    const chatSearchMatches = useMemo(() => {
        if (!chatSearchOpen)
            return [];
        const q = debouncedChatSearchQuery.trim();
        if (!q)
            return [];
        return blocks
            .filter((b): b is Extract<RenderBlock, { type: 'message' }> => b.type === 'message')
            .filter((b) => dailyMessageMatchesSearch(b.msg, q))
            .map((b) => b.id);
    }, [blocks, chatSearchOpen, debouncedChatSearchQuery]);

    const activeSearchMatchId = chatSearchMatches[chatSearchIndex] ?? null;
    const chatSearchTrimmed = debouncedChatSearchQuery.trim();

    const filteredChats = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q)
            return chatPreviews;
        return chatPreviews.filter((c) => c.title.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q));
    }, [chatPreviews, searchQuery]);

    const groupedChats = useMemo(() => {
        const company = filteredChats.filter((c) => c.isCompanyChannel);
        const channels = filteredChats.filter((c) => c.isChannel && !c.isCompanyChannel);
        const groups = filteredChats.filter((c) => c.isGroup && !c.isCompanyChannel);
        const dms = filteredChats.filter((c) => c.roomType === 'dm');
        return { company, channels, groups, dms };
    }, [filteredChats]);

    const filteredEmployees = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q)
            return employees;
        return employees.filter((e) => employeeSearchText(e).toLowerCase().includes(q));
    }, [employees, searchQuery]);

    const sidebarBusy = employeesLoading || roomsLoading;

    const scrollFeedToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
        virtualFeedRef.current?.scrollToBottom(behavior);
        const el = feedRef.current;
        if (el)
            el.scrollTop = el.scrollHeight;
    }, []);

    const loadOlderWithScrollAnchor = useCallback(async () => {
        if (activeRoomId == null || loadingOlder || !hasMoreOlder || loadingOlderScrollRef.current)
            return;
        const el = feedRef.current;
        const prevScrollHeight = el?.scrollHeight ?? 0;
        const prevScrollTop = el?.scrollTop ?? 0;
        pinnedToBottomRef.current = false;
        loadingOlderScrollRef.current = true;
        try {
            const loaded = await loadOlderMessages(activeRoomId);
            if (!loaded)
                return;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const scrollEl = feedRef.current;
                    if (!scrollEl)
                        return;
                    scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight + prevScrollTop;
                });
            });
        }
        finally {
            loadingOlderScrollRef.current = false;
        }
    }, [activeRoomId, hasMoreOlder, loadOlderMessages, loadingOlder]);

    useEffect(() => {
        pinnedToBottomRef.current = true;
    }, [activeChatId]);

    useEffect(() => {
        setReplyTo(null);
        setReactionPickerMsgId(null);
        setCtxMenu(null);
    }, [activeChatId]);

    useEffect(() => {
        const el = feedRef.current;
        if (!el)
            return;
        const onScroll = () => {
            const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
            pinnedToBottomRef.current = dist <= CHAT_BOTTOM_PIN_THRESHOLD_PX;
            if (el.scrollTop <= CHAT_LOAD_OLDER_THRESHOLD_PX)
                void loadOlderWithScrollAnchor();
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [activeChatId, loadOlderWithScrollAnchor]);

    useLayoutEffect(() => {
        if (chatSearchOpen || !pinnedToBottomRef.current)
            return;
        scrollFeedToBottom('auto');
        const raf1 = requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollFeedToBottom('auto'));
        });
        return () => cancelAnimationFrame(raf1);
    }, [blocks, activeChatId, chatSearchOpen, scrollFeedToBottom]);

    useEffect(() => {
        if (chatSearchOpen || messagesLoading || initialPaneLoading)
            return;
        pinnedToBottomRef.current = true;
        scrollFeedToBottom('auto');
        const t1 = window.setTimeout(() => scrollFeedToBottom('auto'), 0);
        const t2 = window.setTimeout(() => scrollFeedToBottom('auto'), 80);
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
        };
    }, [activeChatId, messagesLoading, initialPaneLoading, chatSearchOpen, scrollFeedToBottom]);

    useEffect(() => {
        const inner = messagesInnerRef.current;
        if (!inner || chatSearchOpen)
            return;
        const ro = new ResizeObserver(() => {
            if (pinnedToBottomRef.current)
                scrollFeedToBottom('auto');
        });
        ro.observe(inner);
        return () => ro.disconnect();
    }, [activeChatId, chatSearchOpen, scrollFeedToBottom]);

    useEffect(() => {
        let cancelled = false;
        setEmployeesLoading(true);
        setEmployeesError(null);
        listContactsColleagues()
            .then((rows) => {
                if (cancelled)
                    return;
                setEmployees(mergeEmployeeDirectory(rows));
            })
            .catch((e) => {
                if (!cancelled) {
                    setEmployeesError(e instanceof Error ? e.message : 'Не удалось загрузить сотрудников');
                    setEmployees([]);
                }
            })
            .finally(() => {
                if (!cancelled)
                    setEmployeesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setChatNotificationContext({
            onKostaDailyPage: true,
            activeRoomId,
        });
        return () => setChatNotificationContext({ onKostaDailyPage: false, activeRoomId: null });
    }, [activeRoomId]);

    useEffect(() => {
        const raw = searchParams.get('room');
        const roomId = raw != null ? Number(raw) : NaN;
        if (!Number.isFinite(roomId) || roomId <= 0 || roomsLoading)
            return;
        if (!chatPreviews.some((c) => c.roomId === roomId))
            return;
        selectRoom(roomId);
        if (isMobile)
            setMobileShowChat(true);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('room');
            return next;
        }, { replace: true });
    }, [searchParams, roomsLoading, chatPreviews, selectRoom, isMobile, setSearchParams]);

    useEffect(() => {
        setDraft('');
        setPickerOpen(false);
        setChatSearchOpen(false);
        setChatSearchQuery('');
        setChatSearchIndex(0);
    }, [activeChatId]);

    useEffect(() => {
        setChatSearchIndex(0);
    }, [chatSearchQuery]);

    useEffect(() => {
        if (!chatSearchOpen || !activeSearchMatchId)
            return;
        virtualFeedRef.current?.scrollToBlockId(activeSearchMatchId, 'smooth');
    }, [chatSearchOpen, activeSearchMatchId, chatSearchIndex]);

    useEffect(() => {
        if (!chatSearchOpen)
            return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setChatSearchOpen(false);
                setChatSearchQuery('');
                setChatSearchIndex(0);
                return;
            }
            if (e.key === 'Enter' && chatSearchMatches.length > 0) {
                e.preventDefault();
                if (e.shiftKey) {
                    setChatSearchIndex((i) => (i - 1 + chatSearchMatches.length) % chatSearchMatches.length);
                }
                else {
                    setChatSearchIndex((i) => (i + 1) % chatSearchMatches.length);
                }
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [chatSearchOpen, chatSearchMatches.length]);

    const closeChatSearch = useCallback(() => {
        setChatSearchOpen(false);
        setChatSearchQuery('');
        setChatSearchIndex(0);
    }, []);

    const openChatSearch = useCallback(() => {
        setChatSearchOpen(true);
        requestAnimationFrame(() => chatSearchInputRef.current?.focus());
    }, []);

    const goToPrevSearchMatch = useCallback(() => {
        if (chatSearchMatches.length === 0)
            return;
        setChatSearchIndex((i) => (i - 1 + chatSearchMatches.length) % chatSearchMatches.length);
    }, [chatSearchMatches.length]);

    const labelByUserId = useCallback((id: number) => {
        const emp = employees.find((e) => e.id === id);
        if (emp)
            return employeeLabel(emp);
        return `Пользователь ${id}`;
    }, [employees]);

    const canOpenRoomMembers = activeRoom != null && (
        activeRoom.room_type === 'group'
        || activeRoom.room_type === 'channel'
        || activeRoom.is_company_channel
    );

    const canManageRoomMembers = canOpenRoomMembers
        && activeRoom != null
        && (activeRoom.room_type === 'group' || activeRoom.room_type === 'channel')
        && activeRoom.my_role === 'admin';

    const openRoomMembers = useCallback(() => {
        if (!canOpenRoomMembers)
            return;
        setRoomMembersOpen(true);
    }, [canOpenRoomMembers]);

    const goToNextSearchMatch = useCallback(() => {
        if (chatSearchMatches.length === 0)
            return;
        setChatSearchIndex((i) => (i + 1) % chatSearchMatches.length);
    }, [chatSearchMatches.length]);

    const handleChatSelect = useCallback((chatId: string) => {
        const roomId = Number(chatId);
        if (!Number.isFinite(roomId))
            return;
        selectRoom(roomId);
        if (sidebarView !== 'chats')
            setSidebarView('chats');
        const narrowLayout = typeof window !== 'undefined'
            && window.matchMedia(MOBILE_LAYOUT_MQ).matches;
        if (narrowLayout || isMobile)
            setMobileShowChat(true);
    }, [isMobile, sidebarView, selectRoom]);

    const handleChatPrefetch = useCallback((chatId: string) => {
        const roomId = Number(chatId);
        if (Number.isFinite(roomId))
            prefetchRoomMessages(roomId);
    }, [prefetchRoomMessages]);

    const renderChatItem = useCallback((chat: ChatPreview) => {
        const active = chat.id === activeChatId;
        return (
            <button
                type="button"
                className={`kd-tg__chat-item${active ? ' kd-tg__chat-item--active' : ''}${chat.isCompanyChannel ? ' kd-tg__chat-item--pinned' : ''}`}
                onClick={() => handleChatSelect(chat.id)}
                onMouseEnter={() => handleChatPrefetch(chat.id)}
                onFocus={() => handleChatPrefetch(chat.id)}
                aria-current={active ? 'true' : undefined}
            >
                <span
                    className="kd-tg__chat-avatar"
                    style={{ background: avatarColor(chat.title) }}
                    aria-hidden
                >
                    {chatListAvatar(chat)}
                </span>
                <span className="kd-tg__chat-body">
                    <span className="kd-tg__chat-row">
                        <span className="kd-tg__chat-title">{chat.title}</span>
                        <time className="kd-tg__chat-time">{chat.time}</time>
                    </span>
                    <span className="kd-tg__chat-row">
                        <span className="kd-tg__chat-preview">{chat.lastMessage}</span>
                        {unreadByChat[chat.id] ? (
                            <span className="kd-tg__chat-unread" aria-label={`${unreadByChat[chat.id]} непрочитанных`}>
                                {unreadByChat[chat.id]}
                            </span>
                        ) : null}
                    </span>
                </span>
                {chat.pinned ? <span className="kd-tg__chat-pin" aria-hidden /> : null}
            </button>
        );
    }, [activeChatId, handleChatSelect, handleChatPrefetch, unreadByChat]);

    const chatListItems = useMemo((): KostaDailyChatListItem[] => {
        const items: KostaDailyChatListItem[] = [];
        const pushSection = (id: string, label: string, chats: ChatPreview[]) => {
            if (chats.length === 0)
                return;
            items.push({ kind: 'section', id, label });
            for (const chat of chats) {
                items.push({ kind: 'chat', id: chat.id, node: renderChatItem(chat) });
            }
        };
        for (const chat of groupedChats.company)
            items.push({ kind: 'chat', id: chat.id, node: renderChatItem(chat) });
        pushSection('sec-channels', 'Каналы', groupedChats.channels);
        pushSection('sec-groups', 'Группы', groupedChats.groups);
        pushSection('sec-dms', 'Личные', groupedChats.dms);
        return items;
    }, [groupedChats, renderChatItem]);

    const handleEmployeeOpenDm = useCallback((empId: number) => {
        if (user?.id != null && empId === user.id)
            return;
        setOpeningDmUserId(empId);
        void openDmWithUser(empId).finally(() => setOpeningDmUserId(null));
    }, [openDmWithUser, user?.id]);

    const employeeListItems = useMemo((): KostaDailyEmployeeListItem[] => {
        return filteredEmployees.map((emp) => {
            const name = employeeLabel(emp);
            const pos = emp.position?.trim() || emp.role?.trim() || 'Сотрудник';
            const isMe = user?.id != null && emp.id === user.id;
            return {
                id: emp.id,
                node: (
                    <button
                        type="button"
                        className="kd-tg__member-row kd-tg__member-row--btn"
                        disabled={isMe || openingDmUserId === emp.id}
                        onClick={() => handleEmployeeOpenDm(emp.id)}
                        title={isMe ? undefined : 'Написать сообщение'}
                    >
                        <span
                            className="kd-tg__member-avatar"
                            style={{ background: avatarColor(name) }}
                            aria-hidden
                        >
                            {initials(name)}
                        </span>
                        <span className="kd-tg__member-body">
                            <span className="kd-tg__member-name">
                                {name}
                                {isMe ? <span className="kd-tg__member-you">вы</span> : null}
                            </span>
                            <span className="kd-tg__member-meta">{pos}</span>
                            {emp.email ? (
                                <span className="kd-tg__member-email">{emp.email}</span>
                            ) : null}
                        </span>
                    </button>
                ),
            };
        });
    }, [filteredEmployees, employeeLabel, handleEmployeeOpenDm, openingDmUserId, user?.id]);

    const scrollToMessage = useCallback((messageId: number) => {
        virtualFeedRef.current?.scrollToBlockId(String(messageId), 'smooth');
    }, []);

    const startReply = useCallback((msg: DailyMessage) => {
        if (msg.isDeleted)
            return;
        const messageId = Number(msg.id);
        if (!Number.isFinite(messageId) || messageId <= 0)
            return;
        setReplyTo({
            messageId,
            authorName: msg.authorName,
            preview: formatReplyPreview(msg.text, false),
        });
        setPickerOpen(false);
        setReplyFlashId(msg.id);
        setTimeout(() => setReplyFlashId(null), 350);
    }, []);

    const clearReply = useCallback(() => setReplyTo(null), []);

    const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

    const openCtxMenu = useCallback((clientX: number, clientY: number, msg: DailyMessage, own: boolean) => {
        if (msg.isDeleted)
            return;
        const MENU_W = 240;
        const MENU_H = 280;
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.min(Math.max(clientX, pad), vw - MENU_W - pad);
        const y = Math.min(Math.max(clientY, pad), vh - MENU_H - pad);
        setReactionPickerMsgId(null);
        setCtxMenu({ msg, own, x, y });
    }, []);

    const handleBubbleContextMenu = useCallback((e: React.MouseEvent, msg: DailyMessage, own: boolean) => {
        if (msg.isDeleted)
            return;
        e.preventDefault();
        openCtxMenu(e.clientX, e.clientY, msg, own);
    }, [openCtxMenu]);

    const handleBubbleTouchStart = useCallback((e: React.TouchEvent, msg: DailyMessage, own: boolean) => {
        if (msg.isDeleted)
            return;
        const touch = e.touches[0];
        if (!touch)
            return;
        const { clientX, clientY } = touch;
        if (longPressTimerRef.current != null)
            window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = window.setTimeout(() => {
            openCtxMenu(clientX, clientY, msg, own);
        }, 480);
    }, [openCtxMenu]);

    const cancelLongPress = useCallback(() => {
        if (longPressTimerRef.current != null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const handleCopyMessage = useCallback((text: string) => {
        const plain = text.trim();
        if (plain && navigator.clipboard?.writeText)
            void navigator.clipboard.writeText(plain).catch(() => {  });
        setCtxMenu(null);
    }, []);

    const handleDeleteMessage = useCallback(async (msg: DailyMessage) => {
        setCtxMenu(null);
        const messageId = Number(msg.id);
        if (!Number.isFinite(messageId) || messageId <= 0)
            return;
        const ok = await showConfirm({
            title: 'Удалить сообщение?',
            message: 'Сообщение будет удалено для всех участников чата.',
            confirmLabel: 'Удалить',
            cancelLabel: 'Отмена',
            variant: 'danger',
        });
        if (ok)
            await deleteMessage(messageId);
    }, [showConfirm, deleteMessage]);

    useEffect(() => {
        if (!lightboxUrl)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setLightboxUrl(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxUrl]);

    useEffect(() => {
        if (!ctxMenu)
            return;
        const close = () => setCtxMenu(null);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setCtxMenu(null);
        };
        window.addEventListener('resize', close);
        window.addEventListener('keydown', onKey);
        const feed = feedRef.current;
        feed?.addEventListener('scroll', close, { passive: true });
        return () => {
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', onKey);
            feed?.removeEventListener('scroll', close);
        };
    }, [ctxMenu]);

    const handleSendMessage = useCallback(() => {
        const text = draft.trim();
        if (!text || sending)
            return;
        const replyId = replyTo?.messageId;
        pinnedToBottomRef.current = true;
        void sendMessage(text, replyId).then(() => {
            setDraft('');
            setReplyTo(null);
        });
    }, [draft, sending, sendMessage, replyTo]);

    const handleSendBody = useCallback(async (body: string) => {
        const replyId = replyTo?.messageId;
        pinnedToBottomRef.current = true;
        await sendMessage(body, replyId);
        setReplyTo(null);
        setPickerOpen(false);
    }, [sendMessage, replyTo]);

    const handleAttachFile = useCallback((file: File) => {
        const caption = draft.trim();
        const replyId = replyTo?.messageId;
        pinnedToBottomRef.current = true;
        void sendFile(file, caption, replyId).then(() => {
            setDraft('');
            setReplyTo(null);
        });
    }, [draft, sendFile, replyTo]);

    const openSidebar = useCallback(() => {
        if (isMobile)
            setMobileShowChat(false);
        else
            setSidebarCollapsed(false);
    }, [isMobile]);

    const handleToggleReactionPicker = useCallback((blockId: string) => {
        setReactionPickerMsgId((prev) => prev === blockId ? null : blockId);
    }, []);

    const ctxMenuMsgId = ctxMenu ? String(ctxMenu.msg.id) : null;

    const renderFeedBlock = useCallback((block: RenderBlock) => (
        <KostaDailyFeedBlock
            block={block}
            chatSearchOpen={chatSearchOpen}
            chatSearchTrimmed={chatSearchTrimmed}
            activeSearchMatchId={activeSearchMatchId}
            reactionPickerMsgId={reactionPickerMsgId}
            replyFlashId={replyFlashId}
            ctxMenuMsgId={ctxMenuMsgId}
            userId={user?.id ?? null}
            canClosePoll={Boolean(user && (block.type === 'message' && (block.own || activeRoom?.my_role === 'admin')))}
            onStartReply={startReply}
            onToggleReactionPicker={handleToggleReactionPicker}
            onToggleReaction={toggleReaction}
            onScrollToMessage={scrollToMessage}
            onVotePoll={votePoll}
            onClosePoll={closePoll}
            onPreviewAttachment={setLightboxUrl}
            onBubbleContextMenu={handleBubbleContextMenu}
            onBubbleTouchStart={handleBubbleTouchStart}
            onCancelLongPress={cancelLongPress}
        />
    ), [
        chatSearchOpen,
        chatSearchTrimmed,
        activeSearchMatchId,
        reactionPickerMsgId,
        replyFlashId,
        ctxMenuMsgId,
        user?.id,
        activeRoom?.my_role,
        startReply,
        handleToggleReactionPicker,
        toggleReaction,
        scrollToMessage,
        votePoll,
        closePoll,
        handleBubbleContextMenu,
        handleBubbleTouchStart,
        cancelLongPress,
    ]);

    const showSidebarToggle = isMobile ? mobileShowChat : sidebarCollapsed;

    return (
      <>
      <div
        className={`kd-tg${sidebarCollapsed && !isMobile ? ' kd-tg--sidebar-collapsed' : ''}${sidebarBusy ? ' kd-tg--loading' : ''}`}
        aria-busy={sidebarBusy}
      >
        {sidebarBusy ? (
          <span className="visually-hidden" role="status">Загрузка Kosta Daily…</span>
        ) : null}
        <aside
          className={`kd-tg__sidebar${mobileShowChat ? ' kd-tg__sidebar--hidden-mobile' : ''}`}
          aria-label={sidebarView === 'chats' ? 'Список чатов' : 'Список сотрудников'}
        >
          <header className="kd-tg__sidebar-head">
            <AppBackButton to={routes.home} iconOnly className="kd-tg__sidebar-back" />
            <span className="kd-tg__sidebar-seal" aria-hidden>
                <IconSeal />
            </span>
            <div className="kd-tg__search-wrap">
              <span className="kd-tg__search-icon" aria-hidden><IconSearch /></span>
              <input
                type="search"
                className="kd-tg__search"
                placeholder={sidebarView === 'chats' ? 'Поиск' : 'Поиск сотрудника'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="kd-tg__sidebar-actions">
              {sidebarView === 'chats' ? (
                <>
                  <button
                    type="button"
                    className="kd-tg__icon-btn"
                    title="Создать группу"
                    aria-label="Создать группу"
                    onClick={() => setCreateRoomKind('group')}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="kd-tg__icon-btn"
                    title="Создать канал"
                    aria-label="Создать канал"
                    onClick={() => setCreateRoomKind('channel')}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
                      <path d="M18 11c.7 0 1.37.1 2 .29V10c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H8C6.9 3 6 3.9 6 5v3H5c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6.71c-.63.18-1.3.29-2 .29-2.76 0-5-2.24-5-5s2.24-5 5-5zM12 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                    </svg>
                  </button>
                </>
              ) : null}
              <AppPageSettings />
            </div>
          </header>

          <div className="kd-tg__sidebar-tabs" role="tablist" aria-label="Раздел боковой панели">
            <button
              type="button"
              role="tab"
              aria-selected={sidebarView === 'chats'}
              className={`kd-tg__sidebar-tab${sidebarView === 'chats' ? ' kd-tg__sidebar-tab--active' : ''}`}
              onClick={() => setSidebarView('chats')}
            >
              Чаты
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarView === 'members'}
              className={`kd-tg__sidebar-tab${sidebarView === 'members' ? ' kd-tg__sidebar-tab--active' : ''}`}
              onClick={() => setSidebarView('members')}
            >
              Сотрудники
              {employees.length > 0 ? (
                <span className="kd-tg__sidebar-tab-count">{employees.length}</span>
              ) : null}
            </button>
          </div>

          {roomsError && sidebarView === 'chats' && (
            <p className="kd-tg__members-status kd-tg__members-status--error" role="alert">{roomsError}</p>
          )}
          {sidebarBusy ? (
            sidebarView === 'chats' ? <KostaDailyChatListSkeleton /> : <KostaDailyMembersSkeleton />
          ) : sidebarView === 'chats' ? (
          <>
            {filteredChats.length === 0 && !roomsError ? (
              <p className="kd-tg__members-status">Нет чатов</p>
            ) : (
              <KostaDailyVirtualChatList listRef={chatListRef} items={chatListItems} />
            )}
          </>
          ) : (
          <div className="kd-tg__members" role="tabpanel">
            {employeesError && (
              <p className="kd-tg__members-status kd-tg__members-status--error" role="alert">{employeesError}</p>
            )}
            {!employeesLoading && !employeesError && filteredEmployees.length === 0 && (
              <p className="kd-tg__members-status">Никого не найдено</p>
            )}
            <KostaDailyVirtualEmployeesList listRef={membersListRef} items={employeeListItems} />
          </div>
          )}
        </aside>

        <section
          className={`kd-tg__chat-pane${mobileShowChat ? ' kd-tg__chat-pane--visible-mobile' : ''}`}
          aria-label={activeChat.title}
        >
          {initialPaneLoading || activeRoomId == null ? (
            <KostaDailyChatPaneSkeleton />
          ) : (<>
          <header className={`kd-tg__chat-head${chatSearchOpen ? ' kd-tg__chat-head--search' : ''}`}>
            {chatSearchOpen ? (
            <div className="kd-tg__chat-search" role="search">
              <button
                type="button"
                className="kd-tg__icon-btn"
                onClick={closeChatSearch}
                aria-label="Закрыть поиск"
              >
                <IconBack />
              </button>
              <div className="kd-tg__chat-search-field">
                <span className="kd-tg__chat-search-field-icon" aria-hidden><IconSearch /></span>
                <input
                  ref={chatSearchInputRef}
                  type="search"
                  className="kd-tg__chat-search-input"
                  placeholder="Поиск по сообщениям"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  aria-label="Поиск по сообщениям в чате"
                />
              </div>
              <span className="kd-tg__chat-search-meta" aria-live="polite">
                {chatSearchTrimmed ? (
                  chatSearchMatches.length > 0
                    ? `${chatSearchIndex + 1} из ${chatSearchMatches.length}`
                    : 'Нет результатов'
                ) : (
                  'Введите запрос'
                )}
              </span>
              <button
                type="button"
                className="kd-tg__icon-btn"
                title="Предыдущее совпадение"
                aria-label="Предыдущее совпадение"
                disabled={chatSearchMatches.length === 0}
                onClick={goToPrevSearchMatch}
              >
                <IconChevronUp />
              </button>
              <button
                type="button"
                className="kd-tg__icon-btn"
                title="Следующее совпадение"
                aria-label="Следующее совпадение"
                disabled={chatSearchMatches.length === 0}
                onClick={goToNextSearchMatch}
              >
                <IconChevronDown />
              </button>
            </div>
            ) : (
            <>
            {showSidebarToggle ? (
            <button
              type="button"
              className="kd-tg__icon-btn kd-tg__icon-btn--sidebar-toggle"
              onClick={openSidebar}
              aria-label="Открыть список чатов"
            >
              <IconBack />
            </button>
            ) : null}
            <button
              type="button"
              className="kd-tg__chat-head-main"
              aria-label="Информация о чате"
              onClick={canOpenRoomMembers ? openRoomMembers : (isMobile ? openSidebar : undefined)}
            >
              <span className="kd-tg__chat-head-avatar" style={{ background: avatarColor(activeChat.title) }} aria-hidden>
                {chatListAvatar(activeChat)}
              </span>
              <span className="kd-tg__chat-head-text">
                <span className="kd-tg__chat-head-title">{activeChat.title}</span>
                <span className="kd-tg__chat-head-status">{memberCountLabel}</span>
              </span>
            </button>
            <div className="kd-tg__chat-head-actions">
              <button
                type="button"
                className="kd-tg__icon-btn"
                title="Поиск по чату"
                aria-label="Поиск по чату"
                onClick={openChatSearch}
              >
                <IconSearch />
              </button>
              <button
                type="button"
                className="kd-tg__icon-btn"
                title={canOpenRoomMembers ? 'Участники' : 'Меню'}
                aria-label={canOpenRoomMembers ? 'Участники чата' : 'Меню чата'}
                onClick={canOpenRoomMembers ? openRoomMembers : undefined}
                disabled={!canOpenRoomMembers}
              >
                <IconMenu />
              </button>
            </div>
            </>
            )}
          </header>

          {messagesError && (
            <p className="kd-tg__chat-pane-error" role="alert">{messagesError}</p>
          )}
          <div className="kd-tg__chat-scroll" ref={feedRef}>
            {loadingOlder && (
              <div className="kd-tg__history-hint" aria-live="polite">
                Загрузка истории…
              </div>
            )}
            <KostaDailyVirtualFeed
              key={activeChatId}
              ref={virtualFeedRef}
              scrollRef={feedRef}
              innerRef={messagesInnerRef}
              blocks={blocks}
              renderBlock={renderFeedBlock}
            />
          </div>

          {canPost ? (
            <KostaDailyComposer
              draft={draft}
              onDraftChange={setDraft}
              onSend={handleSendMessage}
              onSendBody={handleSendBody}
              onAttachFile={handleAttachFile}
              sending={sending}
              disabled={activeRoomId == null}
              sendError={sendError}
              pickerOpen={pickerOpen}
              pickerTab={pickerTab}
              onPickerOpenChange={setPickerOpen}
              onPickerTabChange={setPickerTab}
              replyTo={replyTo ? { authorName: replyTo.authorName, preview: replyTo.preview } : null}
              onCancelReply={clearReply}
              onCreatePoll={() => setPollModalOpen(true)}
            />
          ) : (
            <footer className="kd-tg__composer kd-tg__composer--readonly">
              <p className="kd-tg__composer-readonly">
                В этом канале публиковать могут только администраторы. Подпишитесь как админ или напишите в общий чат Kosta Daily.
              </p>
            </footer>
          )}
          </>)}
        </section>
      </div>

      {ctxMenu ? createPortal(
        <div
          className="kd-tg__ctx-overlay"
          role="presentation"
          onClick={closeCtxMenu}
          onContextMenu={(e) => { e.preventDefault(); closeCtxMenu(); }}
        >
          <div
            className="kd-tg__ctx"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kd-tg__ctx-reactions" role="group" aria-label="Реакции">
              {REACTION_EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  className="kd-tg__ctx-reaction"
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    const id = Number(ctxMenu.msg.id);
                    closeCtxMenu();
                    if (Number.isFinite(id))
                      void toggleReaction(id, emoji);
                  }}
                >
                  <TwemojiEmoji emoji={emoji} size="26px" title={label} />
                </button>
              ))}
            </div>
            <div className="kd-tg__ctx-actions">
              <button
                type="button"
                className="kd-tg__ctx-item"
                role="menuitem"
                onClick={() => { const m = ctxMenu.msg; closeCtxMenu(); startReply(m); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 17 4 12 9 7" />
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                </svg>
                <span>Ответить</span>
              </button>
              {ctxMenu.msg.text.trim().length > 0 ? (
                <button
                  type="button"
                  className="kd-tg__ctx-item"
                  role="menuitem"
                  onClick={() => handleCopyMessage(ctxMenu.msg.text)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Копировать текст</span>
                </button>
              ) : null}
              {ctxMenu.own ? (
                <button
                  type="button"
                  className="kd-tg__ctx-item kd-tg__ctx-item--danger"
                  role="menuitem"
                  onClick={() => void handleDeleteMessage(ctxMenu.msg)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Удалить</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {lightboxUrl ? createPortal(
        <div
          className="kd-tg__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="kd-tg__lightbox-close"
            aria-label="Закрыть"
            onClick={() => setLightboxUrl(null)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img className="kd-tg__lightbox-img" src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body,
      ) : null}

      <KostaDailyCreateRoomModal
        open={createRoomKind != null}
        kind={createRoomKind ?? 'group'}
        employees={employees}
        currentUserId={user?.id}
        onClose={() => setCreateRoomKind(null)}
        onSubmit={async (title, memberIds) => {
          if (createRoomKind === 'channel')
            await createChannelRoom(title, memberIds);
          else
            await createGroupRoom(title, memberIds);
        }}
      />

      <KostaDailyPollComposerModal
        open={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onSubmit={createPoll}
      />

      <KostaDailyRoomMembersModal
        open={roomMembersOpen}
        roomId={activeRoomId}
        roomTitle={activeChat.title}
        roomType={activeRoom?.room_type ?? activeChat.roomType}
        canManageMembers={canManageRoomMembers}
        employees={employees}
        currentUserId={user?.id}
        labelByUserId={labelByUserId}
        onClose={() => setRoomMembersOpen(false)}
      />
      </>
    );
}
