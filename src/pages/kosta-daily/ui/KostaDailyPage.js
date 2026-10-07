import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { AppBackButton, AppPageSettings, AttentionBanner, TwemojiEmoji, useAppDialog } from '@shared/ui';
import { useCurrentUser, useDebouncedValue, useMediaQuery } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { listContactsColleagues } from '@entities/contacts';
import { formatReplyPreview, setChatNotificationContext } from '@entities/chat';
import { useI18n } from '@shared/i18n';
import { useKostaDailyChat } from '../model/useKostaDailyChat';
import { KostaDailyChatListSkeleton, KostaDailyChatPaneSkeleton, KostaDailyMembersSkeleton, } from './KostaDailySkeleton';
import { KostaDailyComposer } from './KostaDailyComposer';
import { KostaDailyCreateRoomModal } from './KostaDailyCreateRoomModal';
import { KostaDailyPollComposerModal } from './KostaDailyPollComposerModal';
import { KostaDailyChecklistComposerModal } from './KostaDailyChecklistComposerModal';
import { KostaDailyRoomMembersModal } from './KostaDailyRoomMembersModal';
import { KostaDailyVirtualFeed } from './KostaDailyVirtualFeed';
import { KostaDailyVirtualChatList } from './KostaDailyVirtualChatList';
import { KostaDailyVirtualEmployeesList } from './KostaDailyVirtualEmployeesList';
import { KostaDailyFeedBlock } from './KostaDailyFeedBlock';
import { KostaDailyPinnedBar } from './KostaDailyPinnedBar';
import { avatarColor, initials } from './kostaDailyAvatar';
import { dailyMessageMatchesSearch } from './kostaDailySearchHighlight';
import { REACTION_EMOJIS } from './kostaDailyReactions';
import './KostaDailyPage.css';
const MOBILE_LAYOUT_MQ = '(max-width: 860px)';
const CHAT_BOTTOM_PIN_THRESHOLD_PX = 96;
const CHAT_LOAD_OLDER_THRESHOLD_PX = 120;
function IconGroupPeople() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: "22", height: "22", "aria-hidden": true, children: _jsx("path", { d: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" }) }));
}
function chatListAvatar(chat) {
    if (chat.isCompanyChannel)
        return _jsx(IconGroupPeople, {});
    if (chat.isChannel)
        return '📢';
    if (chat.isGroup)
        return _jsx(IconGroupPeople, {});
    return initials(chat.title);
}
function employeeLabel(u) {
    const n = u.display_name?.trim();
    if (n)
        return n;
    return u.email?.trim() || `Пользователь ${u.id}`;
}
function employeeSearchText(u) {
    return [u.display_name, u.email, u.position, u.role, String(u.id)].filter(Boolean).join(' ');
}
function mergeEmployeeDirectory(rows) {
    const byId = new Map();
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
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.35-4.35" })] }));
}
function IconMenu() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: [_jsx("circle", { cx: "5", cy: "12", r: "1.5" }), _jsx("circle", { cx: "12", cy: "12", r: "1.5" }), _jsx("circle", { cx: "19", cy: "12", r: "1.5" })] }));
}
function IconBack() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M15 18l-6-6 6-6" }) }));
}
function IconChevronUp() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m18 15-6-6-6 6" }) }));
}
function IconChevronDown() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m6 9 6 6 6-6" }) }));
}
export function KostaDailyPage() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const [searchParams, setSearchParams] = useSearchParams();
    const isMobile = useMediaQuery(MOBILE_LAYOUT_MQ);
    const feedRef = useRef(null);
    const messagesInnerRef = useRef(null);
    const virtualFeedRef = useRef(null);
    const pinnedToBottomRef = useRef(true);
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const loadingOlderScrollRef = useRef(false);
    const chatSearchInputRef = useRef(null);
    const chatListRef = useRef(null);
    const membersListRef = useRef(null);
    const [chatSearchOpen, setChatSearchOpen] = useState(false);
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [chatSearchIndex, setChatSearchIndex] = useState(0);
    const [sidebarView, setSidebarView] = useState('chats');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [roomsRetrying, setRoomsRetrying] = useState(false);
    const [draft, setDraft] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTab, setPickerTab] = useState('emoji');
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(true);
    const [employeesError, setEmployeesError] = useState(null);
    const [openingDmUserId, setOpeningDmUserId] = useState(null);
    const [replyTo, setReplyTo] = useState(null);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
    const [replyFlashId, setReplyFlashId] = useState(null);
    const [createRoomKind, setCreateRoomKind] = useState(null);
    const [pollModalOpen, setPollModalOpen] = useState(false);
    const [checklistModalOpen, setChecklistModalOpen] = useState(false);
    const [roomMembersOpen, setRoomMembersOpen] = useState(false);
    const [ctxMenu, setCtxMenu] = useState(null);
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const longPressTimerRef = useRef(null);
    const { roomsLoading, roomsError, messagesError, messagesLoading, loadingOlder, hasMoreOlder, loadOlderMessages, sendError, initialPaneLoading, chatPreviews, activeRoomId, activePreview, activeRoom, blocks, unreadByChat, memberCountLabel, selectRoom, prefetchRoomMessages, sendMessage, sendFile, sending, openDmWithUser, toggleReaction, deleteMessage, createGroupRoom, deleteGroupRoom, refreshRooms, createChannelRoom, createPoll, createChecklist, toggleChecklistItem, appendChecklistTask, removeChecklistTask, votePoll, closePoll, pins, canPin, pinMessage, unpinMessage, revealMessage, canPost, } = useKostaDailyChat(user?.id, employees);
    const { showConfirm } = useAppDialog();
    const handleRetryRooms = useCallback(() => {
        if (roomsRetrying || roomsLoading)
            return;
        setRoomsRetrying(true);
        void refreshRooms()
            .then((list) => {
            if (list.length === 0)
                return;
            const company = list.find((r) => r.is_company_channel);
            const first = company ?? list[0];
            if (first)
                selectRoom(first.id);
        })
            .catch(() => { })
            .finally(() => setRoomsRetrying(false));
    }, [refreshRooms, roomsLoading, roomsRetrying, selectRoom]);
    const activeChatId = activeRoomId != null ? String(activeRoomId) : '';
    const unreadTotal = useMemo(() => Object.values(unreadByChat).reduce((sum, n) => sum + n, 0), [unreadByChat]);
    const firstUnreadChatId = useMemo(() => Object.keys(unreadByChat)[0] ?? null, [unreadByChat]);
    const unreadBadge = unreadTotal > 99 ? '99+' : String(unreadTotal);
    const activeChat = activePreview ?? {
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
            .filter((b) => b.type === 'message')
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
    const scrollFeedToBottom = useCallback((behavior = 'auto') => {
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
        setShowJumpToBottom(false);
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
            const atBottom = dist <= CHAT_BOTTOM_PIN_THRESHOLD_PX;
            pinnedToBottomRef.current = atBottom;
            setShowJumpToBottom((prev) => (prev === !atBottom ? prev : !atBottom));
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
            if (!pinnedToBottomRef.current)
                return;
            const el = feedRef.current;
            if (!el)
                return;
            const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
            if (dist <= 2)
                return;
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
    const roomParam = searchParams.get('room');
    const consumedRoomParamRef = useRef(null);
    useEffect(() => {
        const onOpenRoom = (event) => {
            const roomId = Number(event.detail?.roomId);
            if (!Number.isFinite(roomId) || roomId <= 0)
                return;
            selectRoom(roomId);
            if (window.matchMedia(MOBILE_LAYOUT_MQ).matches)
                setMobileShowChat(true);
        };
        window.addEventListener('kosta-daily-open-room', onOpenRoom);
        return () => window.removeEventListener('kosta-daily-open-room', onOpenRoom);
    }, [selectRoom]);
    useEffect(() => {
        if (roomParam == null || roomParam === '' || consumedRoomParamRef.current === roomParam)
            return;
        const roomId = Number(roomParam);
        if (!Number.isFinite(roomId) || roomId <= 0 || roomsLoading)
            return;
        if (!chatPreviews.some((c) => c.roomId === roomId))
            return;
        consumedRoomParamRef.current = roomParam;
        selectRoom(roomId);
        if (isMobile)
            setMobileShowChat(true);
        setSearchParams((prev) => {
            if (prev.get('room') !== roomParam)
                return prev;
            const next = new URLSearchParams(prev);
            next.delete('room');
            return next;
        }, { replace: true });
    }, [roomParam, roomsLoading, chatPreviews, selectRoom, isMobile, setSearchParams]);
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
        const onKeyDown = (e) => {
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
    const labelByUserId = useCallback((id) => {
        const emp = employees.find((e) => e.id === id);
        if (emp)
            return employeeLabel(emp);
        return `Пользователь ${id}`;
    }, [employees]);
    const canOpenRoomMembers = activeRoom != null && (activeRoom.room_type === 'group'
        || activeRoom.room_type === 'channel'
        || activeRoom.is_company_channel);
    const canManageRoomMembers = canOpenRoomMembers
        && activeRoom != null
        && (activeRoom.room_type === 'group' || activeRoom.room_type === 'channel')
        && activeRoom.my_role === 'admin';
    const openRoomMembers = useCallback(() => {
        if (!canOpenRoomMembers)
            return;
        setRoomMembersOpen(true);
    }, [canOpenRoomMembers]);
    useEffect(() => {
        if (!roomMembersOpen || activeRoomId == null)
            return;
        if (!chatPreviews.some((c) => c.roomId === activeRoomId))
            setRoomMembersOpen(false);
    }, [roomMembersOpen, activeRoomId, chatPreviews]);
    const goToNextSearchMatch = useCallback(() => {
        if (chatSearchMatches.length === 0)
            return;
        setChatSearchIndex((i) => (i + 1) % chatSearchMatches.length);
    }, [chatSearchMatches.length]);
    const handleChatSelect = useCallback((chatId) => {
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
    const handleChatPrefetch = useCallback((chatId) => {
        const roomId = Number(chatId);
        if (Number.isFinite(roomId))
            prefetchRoomMessages(roomId);
    }, [prefetchRoomMessages]);
    const renderChatItem = useCallback((chat) => {
        const active = chat.id === activeChatId;
        return (_jsxs("button", { type: "button", className: `kd-tg__chat-item${active ? ' kd-tg__chat-item--active' : ''}${chat.isCompanyChannel ? ' kd-tg__chat-item--pinned' : ''}`, onClick: () => handleChatSelect(chat.id), onMouseEnter: () => handleChatPrefetch(chat.id), onFocus: () => handleChatPrefetch(chat.id), "aria-current": active ? 'true' : undefined, children: [_jsx("span", { className: "kd-tg__chat-avatar", style: { background: avatarColor(chat.title) }, "aria-hidden": true, children: chatListAvatar(chat) }), _jsxs("span", { className: "kd-tg__chat-body", children: [_jsxs("span", { className: "kd-tg__chat-row", children: [_jsx("span", { className: "kd-tg__chat-title", children: chat.title }), _jsx("time", { className: "kd-tg__chat-time", children: chat.time })] }), _jsxs("span", { className: "kd-tg__chat-row", children: [_jsx("span", { className: "kd-tg__chat-preview", children: chat.lastMessage }), unreadByChat[chat.id] ? (_jsx("span", { className: "kd-tg__chat-unread", "aria-label": `${unreadByChat[chat.id]} непрочитанных`, children: unreadByChat[chat.id] })) : null] })] }), chat.pinned ? _jsx("span", { className: "kd-tg__chat-pin", "aria-hidden": true }) : null] }));
    }, [activeChatId, handleChatSelect, handleChatPrefetch, unreadByChat]);
    const chatListItems = useMemo(() => {
        const items = [];
        const pushSection = (id, label, chats) => {
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
    const handleEmployeeOpenDm = useCallback((empId) => {
        if (user?.id != null && empId === user.id)
            return;
        setOpeningDmUserId(empId);
        void openDmWithUser(empId).finally(() => setOpeningDmUserId(null));
    }, [openDmWithUser, user?.id]);
    const employeeListItems = useMemo(() => {
        return filteredEmployees.map((emp) => {
            const name = employeeLabel(emp);
            const pos = emp.position?.trim() || emp.role?.trim() || 'Сотрудник';
            const isMe = user?.id != null && emp.id === user.id;
            return {
                id: emp.id,
                node: (_jsxs("button", { type: "button", className: "kd-tg__member-row kd-tg__member-row--btn", disabled: isMe || openingDmUserId === emp.id, onClick: () => handleEmployeeOpenDm(emp.id), title: isMe ? undefined : 'Написать сообщение', children: [_jsx("span", { className: "kd-tg__member-avatar", style: { background: avatarColor(name) }, "aria-hidden": true, children: initials(name) }), _jsxs("span", { className: "kd-tg__member-body", children: [_jsxs("span", { className: "kd-tg__member-name", children: [name, isMe ? _jsx("span", { className: "kd-tg__member-you", children: "\u0432\u044B" }) : null] }), _jsx("span", { className: "kd-tg__member-meta", children: pos }), emp.email ? (_jsx("span", { className: "kd-tg__member-email", children: emp.email })) : null] })] })),
            };
        });
    }, [filteredEmployees, handleEmployeeOpenDm, openingDmUserId, user?.id]);
    const scrollToMessage = useCallback((messageId) => {
        virtualFeedRef.current?.scrollToBlockId(String(messageId), 'smooth');
    }, []);
    const startReply = useCallback((msg) => {
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
    const openCtxMenu = useCallback((clientX, clientY, msg, own) => {
        if (msg.isDeleted)
            return;
        const MENU_W = 240;
        const MENU_H = 320;
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.min(Math.max(clientX, pad), vw - MENU_W - pad);
        const y = Math.min(Math.max(clientY, pad), vh - MENU_H - pad);
        setReactionPickerMsgId(null);
        setCtxMenu({ msg, own, x, y });
    }, []);
    const handleBubbleContextMenu = useCallback((e, msg, own) => {
        if (msg.isDeleted)
            return;
        e.preventDefault();
        openCtxMenu(e.clientX, e.clientY, msg, own);
    }, [openCtxMenu]);
    const handleBubbleTouchStart = useCallback((e, msg, own) => {
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
    const handleCopyMessage = useCallback((text) => {
        const plain = text.trim();
        if (plain && navigator.clipboard?.writeText)
            void navigator.clipboard.writeText(plain).catch(() => { });
        setCtxMenu(null);
    }, []);
    const handleDeleteMessage = useCallback(async (msg) => {
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
        const onKey = (e) => {
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
        const onKey = (e) => {
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
    const handleSendBody = useCallback(async (body) => {
        const replyId = replyTo?.messageId;
        pinnedToBottomRef.current = true;
        await sendMessage(body, replyId);
        setReplyTo(null);
        setPickerOpen(false);
    }, [sendMessage, replyTo]);
    const handleAttachFile = useCallback((file) => {
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
    const handleToggleReactionPicker = useCallback((blockId) => {
        setReactionPickerMsgId((prev) => prev === blockId ? null : blockId);
    }, []);
    const ctxMenuMsgId = ctxMenu ? String(ctxMenu.msg.id) : null;
    const renderFeedBlock = useCallback((block) => (_jsx(KostaDailyFeedBlock, { block: block, chatSearchOpen: chatSearchOpen, chatSearchTrimmed: chatSearchTrimmed, activeSearchMatchId: activeSearchMatchId, reactionPickerMsgId: reactionPickerMsgId, replyFlashId: replyFlashId, ctxMenuMsgId: ctxMenuMsgId, userId: user?.id ?? null, canClosePoll: Boolean(user?.id != null && (block.type === 'message' && (block.own || activeRoom?.my_role === 'admin'))), onStartReply: startReply, onToggleReactionPicker: handleToggleReactionPicker, onToggleReaction: toggleReaction, onScrollToMessage: scrollToMessage, onVotePoll: votePoll, onClosePoll: closePoll, onToggleChecklistItem: toggleChecklistItem, onAppendChecklistTask: appendChecklistTask, onRemoveChecklistTask: removeChecklistTask, onPreviewAttachment: setLightboxUrl, onBubbleContextMenu: handleBubbleContextMenu, onBubbleTouchStart: handleBubbleTouchStart, onCancelLongPress: cancelLongPress })), [
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
        toggleChecklistItem,
        appendChecklistTask,
        removeChecklistTask,
        handleBubbleContextMenu,
        handleBubbleTouchStart,
        cancelLongPress,
    ]);
    const showSidebarToggle = isMobile ? mobileShowChat : sidebarCollapsed;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: `kd-tg${sidebarCollapsed && !isMobile ? ' kd-tg--sidebar-collapsed' : ''}${sidebarBusy ? ' kd-tg--loading' : ''}`, "aria-busy": sidebarBusy, children: [sidebarBusy ? (_jsx("span", { className: "visually-hidden", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 Kosta Daily\u2026" })) : null, _jsxs("aside", { className: `kd-tg__sidebar${mobileShowChat ? ' kd-tg__sidebar--hidden-mobile' : ''}`, "aria-label": sidebarView === 'chats' ? 'Список чатов' : 'Список сотрудников', children: [_jsxs("header", { className: "kd-tg__sidebar-head", children: [_jsxs("div", { className: "kd-tg__sidebar-toolbar", children: [_jsx(AppBackButton, { to: routes.home, iconOnly: true, className: "kd-tg__sidebar-back" }), _jsxs("div", { className: "kd-tg__sidebar-actions", children: [sidebarView === 'chats' ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "kd-tg__icon-btn", title: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443", "aria-label": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443", onClick: () => setCreateRoomKind('group'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: "20", height: "20", "aria-hidden": true, children: _jsx("path", { d: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" }) }) }), _jsx("button", { type: "button", className: "kd-tg__icon-btn", title: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u043D\u0430\u043B", "aria-label": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u043D\u0430\u043B", onClick: () => setCreateRoomKind('channel'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: "20", height: "20", "aria-hidden": true, children: _jsx("path", { d: "M18 11c.7 0 1.37.1 2 .29V10c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H8C6.9 3 6 3.9 6 5v3H5c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6.71c-.63.18-1.3.29-2 .29-2.76 0-5-2.24-5-5s2.24-5 5-5zM12 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" }) }) })] })) : null, _jsx(AppPageSettings, {})] })] }), _jsxs("div", { className: "kd-tg__search-wrap", children: [_jsx("span", { className: "kd-tg__search-icon", "aria-hidden": true, children: _jsx(IconSearch, {}) }), _jsx("input", { type: "search", className: "kd-tg__search", placeholder: sidebarView === 'chats' ? 'Поиск' : 'Поиск сотрудника', "aria-label": sidebarView === 'chats' ? 'Поиск чатов' : 'Поиск сотрудника', value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) }), searchQuery ? (_jsx("button", { type: "button", className: "kd-tg__search-clear", "aria-label": "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A", onClick: () => setSearchQuery(''), children: "\u00D7" })) : null] })] }), _jsxs("div", { className: "kd-tg__sidebar-tabs", role: "tablist", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B \u0431\u043E\u043A\u043E\u0432\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438", children: [_jsxs("button", { type: "button", role: "tab", "aria-selected": sidebarView === 'chats', className: `kd-tg__sidebar-tab${sidebarView === 'chats' ? ' kd-tg__sidebar-tab--active' : ''}`, onClick: () => setSidebarView('chats'), children: ["\u0427\u0430\u0442\u044B", unreadTotal > 0 ? (_jsx("span", { className: "kd-tg__chat-unread", "aria-label": `${unreadTotal} непрочитанных`, children: unreadBadge })) : null] }), _jsxs("button", { type: "button", role: "tab", "aria-selected": sidebarView === 'members', className: `kd-tg__sidebar-tab${sidebarView === 'members' ? ' kd-tg__sidebar-tab--active' : ''}`, onClick: () => setSidebarView('members'), children: ["\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438", employees.length > 0 ? (_jsx("span", { className: "kd-tg__sidebar-tab-count", children: employees.length })) : null] })] }), sidebarView === 'members' && unreadTotal > 0 ? (_jsx(AttentionBanner, { className: "kd-tg__attention", text: t('attentionBanner.chatUnread').replace('{count}', String(unreadTotal)), actionLabel: t('attentionBanner.chatUnreadGo'), onAction: () => {
                                    setSidebarView('chats');
                                    if (firstUnreadChatId)
                                        handleChatSelect(firstUnreadChatId);
                                } })) : null, roomsError && sidebarView === 'chats' && (_jsxs("div", { className: "kd-tg__members-status kd-tg__members-status--error", role: "alert", children: [_jsx("p", { children: roomsError }), _jsx("button", { type: "button", className: "kd-tg__retry-btn", disabled: roomsRetrying || roomsLoading, onClick: handleRetryRooms, children: roomsRetrying || roomsLoading ? 'Загрузка…' : 'Повторить' })] })), sidebarBusy ? (sidebarView === 'chats' ? _jsx(KostaDailyChatListSkeleton, {}) : _jsx(KostaDailyMembersSkeleton, {})) : sidebarView === 'chats' ? (_jsx(_Fragment, { children: filteredChats.length === 0 && !roomsError ? (_jsx("p", { className: "kd-tg__members-status", children: "\u041D\u0435\u0442 \u0447\u0430\u0442\u043E\u0432" })) : (_jsx(KostaDailyVirtualChatList, { listRef: chatListRef, items: chatListItems })) })) : (_jsxs("div", { className: "kd-tg__members", role: "tabpanel", children: [employeesError && (_jsx("p", { className: "kd-tg__members-status kd-tg__members-status--error", role: "alert", children: employeesError })), !employeesLoading && !employeesError && filteredEmployees.length === 0 && (_jsx("p", { className: "kd-tg__members-status", children: "\u041D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" })), _jsx(KostaDailyVirtualEmployeesList, { listRef: membersListRef, items: employeeListItems })] }))] }), _jsx("section", { className: `kd-tg__chat-pane${mobileShowChat ? ' kd-tg__chat-pane--visible-mobile' : ''}`, "aria-label": activeChat.title, children: roomsError && activeRoomId == null ? (_jsxs("div", { className: "kd-tg__chat-pane-error kd-tg__chat-pane-error--full", role: "alert", children: [_jsx("p", { children: roomsError }), _jsx("button", { type: "button", className: "kd-tg__retry-btn", disabled: roomsRetrying || roomsLoading, onClick: handleRetryRooms, children: roomsRetrying || roomsLoading ? 'Загрузка…' : 'Повторить' })] })) : initialPaneLoading || activeRoomId == null ? (_jsx(KostaDailyChatPaneSkeleton, {})) : (_jsxs(_Fragment, { children: [_jsx("header", { className: `kd-tg__chat-head${chatSearchOpen ? ' kd-tg__chat-head--search' : ''}`, children: chatSearchOpen ? (_jsxs("div", { className: "kd-tg__chat-search", role: "search", children: [_jsx("button", { type: "button", className: "kd-tg__icon-btn", onClick: closeChatSearch, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0438\u0441\u043A", children: _jsx(IconBack, {}) }), _jsxs("div", { className: "kd-tg__chat-search-field", children: [_jsx("span", { className: "kd-tg__chat-search-field-icon", "aria-hidden": true, children: _jsx(IconSearch, {}) }), _jsx("input", { ref: chatSearchInputRef, type: "search", className: "kd-tg__chat-search-input", placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\u043C", value: chatSearchQuery, onChange: (e) => setChatSearchQuery(e.target.value), "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\u043C \u0432 \u0447\u0430\u0442\u0435" })] }), _jsx("span", { className: "kd-tg__chat-search-meta", "aria-live": "polite", children: chatSearchTrimmed ? (chatSearchMatches.length > 0
                                                    ? `${chatSearchIndex + 1} из ${chatSearchMatches.length}`
                                                    : 'Нет результатов') : ('Введите запрос') }), _jsx("button", { type: "button", className: "kd-tg__icon-btn", title: "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435", "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435", disabled: chatSearchMatches.length === 0, onClick: goToPrevSearchMatch, children: _jsx(IconChevronUp, {}) }), _jsx("button", { type: "button", className: "kd-tg__icon-btn", title: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435", "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435", disabled: chatSearchMatches.length === 0, onClick: goToNextSearchMatch, children: _jsx(IconChevronDown, {}) })] })) : (_jsxs(_Fragment, { children: [showSidebarToggle ? (_jsx("button", { type: "button", className: "kd-tg__icon-btn kd-tg__icon-btn--sidebar-toggle", onClick: openSidebar, "aria-label": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0447\u0430\u0442\u043E\u0432", children: _jsx(IconBack, {}) })) : null, _jsxs("button", { type: "button", className: "kd-tg__chat-head-main", "aria-label": "\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u0447\u0430\u0442\u0435", onClick: canOpenRoomMembers ? openRoomMembers : (isMobile ? openSidebar : undefined), children: [_jsx("span", { className: "kd-tg__chat-head-avatar", style: { background: avatarColor(activeChat.title) }, "aria-hidden": true, children: chatListAvatar(activeChat) }), _jsxs("span", { className: "kd-tg__chat-head-text", children: [_jsx("span", { className: "kd-tg__chat-head-title", children: activeChat.title }), _jsx("span", { className: "kd-tg__chat-head-status", children: memberCountLabel })] })] }), _jsxs("div", { className: "kd-tg__chat-head-actions", children: [_jsx("button", { type: "button", className: "kd-tg__icon-btn", title: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0447\u0430\u0442\u0443", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0447\u0430\u0442\u0443", onClick: openChatSearch, children: _jsx(IconSearch, {}) }), _jsx("button", { type: "button", className: "kd-tg__icon-btn", title: canOpenRoomMembers ? 'Участники' : 'Меню', "aria-label": canOpenRoomMembers ? 'Участники чата' : 'Меню чата', onClick: canOpenRoomMembers ? openRoomMembers : undefined, disabled: !canOpenRoomMembers, children: _jsx(IconMenu, {}) })] })] })) }), !chatSearchOpen && pins.length > 0 ? (_jsx(KostaDailyPinnedBar, { pins: pins, canUnpin: canPin, onOpen: (messageId) => {
                                        void (async () => {
                                            if (activeRoomId == null)
                                                return;
                                            await revealMessage(activeRoomId, messageId);
                                            setReplyFlashId(String(messageId));
                                            window.setTimeout(() => scrollToMessage(messageId), 60);
                                            window.setTimeout(() => setReplyFlashId(null), 1200);
                                        })();
                                    }, onUnpin: (messageId) => { void unpinMessage(messageId); } })) : null, messagesError && (_jsx("p", { className: "kd-tg__chat-pane-error", role: "alert", children: messagesError })), _jsxs("div", { className: "kd-tg__chat-scroll", ref: feedRef, children: [loadingOlder && (_jsx("div", { className: "kd-tg__history-hint", "aria-live": "polite", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0438\u0441\u0442\u043E\u0440\u0438\u0438\u2026" })), _jsx(KostaDailyVirtualFeed, { ref: virtualFeedRef, scrollRef: feedRef, innerRef: messagesInnerRef, blocks: blocks, renderBlock: renderFeedBlock }, activeChatId)] }), showJumpToBottom && !chatSearchOpen && (_jsx("button", { type: "button", className: "kd-tg__jump-bottom", "aria-label": "\u0412\u043D\u0438\u0437", title: "\u0412\u043D\u0438\u0437", onClick: () => {
                                        pinnedToBottomRef.current = true;
                                        setShowJumpToBottom(false);
                                        scrollFeedToBottom('smooth');
                                    }, children: _jsx("svg", { viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })), canPost ? (_jsx(KostaDailyComposer, { draft: draft, onDraftChange: setDraft, onSend: handleSendMessage, onSendBody: handleSendBody, onAttachFile: handleAttachFile, sending: sending, disabled: activeRoomId == null, sendError: sendError, pickerOpen: pickerOpen, pickerTab: pickerTab, onPickerOpenChange: setPickerOpen, onPickerTabChange: setPickerTab, replyTo: replyTo ? { authorName: replyTo.authorName, preview: replyTo.preview } : null, onCancelReply: clearReply, onCreatePoll: () => setPollModalOpen(true), onCreateChecklist: activeRoom?.room_type === 'group' || activeRoom?.room_type === 'dm'
                                        ? () => setChecklistModalOpen(true)
                                        : undefined })) : (_jsx("footer", { className: "kd-tg__composer kd-tg__composer--readonly", children: _jsx("p", { className: "kd-tg__composer-readonly", children: "\u0412 \u044D\u0442\u043E\u043C \u043A\u0430\u043D\u0430\u043B\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u0442\u044C \u043C\u043E\u0433\u0443\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B. \u041F\u043E\u0434\u043F\u0438\u0448\u0438\u0442\u0435\u0441\u044C \u043A\u0430\u043A \u0430\u0434\u043C\u0438\u043D \u0438\u043B\u0438 \u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0432 \u043E\u0431\u0449\u0438\u0439 \u0447\u0430\u0442 Kosta Daily." }) }))] })) })] }), ctxMenu ? createPortal(_jsx("div", { className: "kd-tg__ctx-overlay", role: "presentation", onClick: closeCtxMenu, onContextMenu: (e) => { e.preventDefault(); closeCtxMenu(); }, children: _jsxs("div", { className: "kd-tg__ctx", style: { left: ctxMenu.x, top: ctxMenu.y }, role: "menu", onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "kd-tg__ctx-reactions", role: "group", "aria-label": "\u0420\u0435\u0430\u043A\u0446\u0438\u0438", children: REACTION_EMOJIS.map(({ emoji, label }) => (_jsx("button", { type: "button", className: "kd-tg__ctx-reaction", title: label, "aria-label": label, onClick: () => {
                                    const id = Number(ctxMenu.msg.id);
                                    closeCtxMenu();
                                    if (Number.isFinite(id))
                                        void toggleReaction(id, emoji);
                                }, children: _jsx(TwemojiEmoji, { emoji: emoji, size: "26px", title: label }) }, emoji))) }), _jsxs("div", { className: "kd-tg__ctx-actions", children: [_jsxs("button", { type: "button", className: "kd-tg__ctx-item", role: "menuitem", onClick: () => { const m = ctxMenu.msg; closeCtxMenu(); startReply(m); }, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "9 17 4 12 9 7" }), _jsx("path", { d: "M20 18v-2a4 4 0 0 0-4-4H4" })] }), _jsx("span", { children: "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C" })] }), canPin ? (_jsxs("button", { type: "button", className: "kd-tg__ctx-item", role: "menuitem", onClick: () => {
                                        const id = Number(ctxMenu.msg.id);
                                        const pinned = pins.some((pin) => pin.message_id === id);
                                        closeCtxMenu();
                                        if (!Number.isFinite(id))
                                            return;
                                        void (pinned ? unpinMessage(id) : pinMessage(id));
                                    }, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M12 17v5" }), _jsx("path", { d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" })] }), _jsx("span", { children: pins.some((pin) => pin.message_id === Number(ctxMenu.msg.id)) ? 'Открепить' : 'Закрепить' })] })) : null, ctxMenu.msg.text.trim().length > 0 ? (_jsxs("button", { type: "button", className: "kd-tg__ctx-item", role: "menuitem", onClick: () => handleCopyMessage(ctxMenu.msg.text), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }), _jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })] }), _jsx("span", { children: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u0435\u043A\u0441\u0442" })] })) : null, ctxMenu.own ? (_jsxs("button", { type: "button", className: "kd-tg__ctx-item kd-tg__ctx-item--danger", role: "menuitem", onClick: () => void handleDeleteMessage(ctxMenu.msg), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }), _jsx("line", { x1: "10", y1: "11", x2: "10", y2: "17" }), _jsx("line", { x1: "14", y1: "11", x2: "14", y2: "17" })] }), _jsx("span", { children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })) : null] })] }) }), document.body) : null, lightboxUrl ? createPortal(_jsxs("div", { className: "kd-tg__lightbox", role: "dialog", "aria-modal": "true", "aria-label": "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F", onClick: () => setLightboxUrl(null), children: [_jsx("button", { type: "button", className: "kd-tg__lightbox-close", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", onClick: () => setLightboxUrl(null), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }), _jsx("img", { className: "kd-tg__lightbox-img", src: lightboxUrl, alt: "", onClick: (e) => e.stopPropagation() })] }), document.body) : null, _jsx(KostaDailyCreateRoomModal, { open: createRoomKind != null, kind: createRoomKind ?? 'group', employees: employees, currentUserId: user?.id, onClose: () => setCreateRoomKind(null), onSubmit: async (title, memberIds) => {
                    if (createRoomKind === 'channel')
                        await createChannelRoom(title, memberIds);
                    else
                        await createGroupRoom(title, memberIds);
                } }), _jsx(KostaDailyPollComposerModal, { open: pollModalOpen, onClose: () => setPollModalOpen(false), onSubmit: createPoll }), _jsx(KostaDailyChecklistComposerModal, { open: checklistModalOpen, onClose: () => setChecklistModalOpen(false), onSubmit: createChecklist }), _jsx(KostaDailyRoomMembersModal, { open: roomMembersOpen, roomId: activeRoomId, roomTitle: activeChat.title, roomType: activeRoom?.room_type ?? activeChat.roomType, canManageMembers: canManageRoomMembers, employees: employees, currentUserId: user?.id, labelByUserId: labelByUserId, onClose: () => setRoomMembersOpen(false), onRenamed: () => { void refreshRooms(); }, onDeleted: async () => {
                    if (activeRoomId == null)
                        return;
                    await deleteGroupRoom(activeRoomId);
                    setRoomMembersOpen(false);
                } })] }));
}
