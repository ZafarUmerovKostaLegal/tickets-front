import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUsersPublic } from '@entities/user';
import {
    fetchChatMessages,
    CHAT_MESSAGES_MAX_LIMIT,
    fetchChatRooms,
    invalidateChatRoomsCache,
    markChatRoomRead,
    postChatMessage,
    uploadChatFile,
    toggleChatReaction,
    createOrGetChatDmRoom,
    createChatGroupRoom,
    createChatChannelRoom,
    createChatPoll,
    voteChatPoll,
    closeChatPoll,
    deleteChatMessage,
    connectChatWs,
    subscribeChatWs,
    parseChatMessageFromWsPayload,
    mergeMessagesSorted,
    roomToPreview,
    apiMessageToDaily,
    buildRenderBlocks,
    COMPANY_CHANNEL_HINT,
    type ChatMessage,
    type ChatReaction,
    type ChatRoom,
    type ChatPreview,
    type CreatePollInput,
    type DailyMessage,
    type RenderBlock,
    resolveRoomTitle,
    roomSubtitle,
} from '@entities/chat';
import type { TimeTrackingUserRow } from '@entities/time-tracking';

const MESSAGES_OLDER_BATCH = CHAT_MESSAGES_MAX_LIMIT;

export function useKostaDailyChat(
    userId: number | null | undefined,
    employees: TimeTrackingUserRow[],
) {
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [roomsLoading, setRoomsLoading] = useState(true);
    const [roomsError, setRoomsError] = useState<string | null>(null);
    const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
    const [messagesByRoom, setMessagesByRoom] = useState<Record<number, ChatMessage[]>>({});
    const [hasMoreOlderByRoom, setHasMoreOlderByRoom] = useState<Record<number, boolean>>({});
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [messagesError, setMessagesError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [extraAuthorLabels, setExtraAuthorLabels] = useState<Record<number, string>>({});
    const labelByUserId = useCallback((id: number) => {
        const extra = extraAuthorLabels[id];
        if (extra)
            return extra;
        const emp = employees.find((e) => e.id === id);
        if (emp) {
            const n = emp.display_name?.trim();
            if (n)
                return n;
            return emp.email?.trim() || `Пользователь ${id}`;
        }
        return `Пользователь ${id}`;
    }, [employees, extraAuthorLabels]);

    useEffect(() => {
        const known = new Set(employees.map((e) => e.id));
        const missing = new Set<number>();
        for (const msgs of Object.values(messagesByRoom)) {
            for (const m of msgs) {
                const aid = m.author_user_id;
                if (aid != null && aid > 0 && !known.has(aid))
                    missing.add(aid);
            }
        }
        if (missing.size === 0)
            return;
        let cancelled = false;
        void getUsersPublic([...missing], true)
            .then(({ items }) => {
                if (cancelled || items.length === 0)
                    return;
                setExtraAuthorLabels((prev) => {
                    const next = { ...prev };
                    for (const u of items) {
                        next[u.id] = u.display_name?.trim() || u.email?.trim() || `Пользователь ${u.id}`;
                    }
                    return next;
                });
            })
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, [employees, messagesByRoom]);

    const refreshRooms = useCallback(() => {
        return fetchChatRooms()
            .then((list) => {
                setRooms(list);
                setRoomsError(null);
                return list;
            })
            .catch((e: unknown) => {
                const msg = e instanceof Error ? e.message : 'Не удалось загрузить чаты';
                setRoomsError(msg);
                throw e;
            });
    }, []);

    useEffect(() => {
        let cancelled = false;
        setRoomsLoading(true);
        setRoomsError(null);
        void refreshRooms()
            .then((list) => {
                if (cancelled || list.length === 0)
                    return;
                setActiveRoomId((prev) => {
                    if (prev != null && list.some((r) => r.id === prev))
                        return prev;
                    const company = list.find((r) => r.is_company_channel);
                    return company?.id ?? list[0].id;
                });
            })
            .catch(() => { })
            .finally(() => {
                if (!cancelled)
                    setRoomsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [refreshRooms]);

    useEffect(() => connectChatWs(), []);

    const upsertRoomMessage = useCallback((roomId: number, msg: ChatMessage) => {
        setMessagesByRoom((prev) => ({
            ...prev,
            [roomId]: mergeMessagesSorted(prev[roomId] ?? [], [msg]),
        }));
    }, []);

    const patchRoomInList = useCallback((roomId: number, msg: ChatMessage) => {
        setRooms((prev) => prev.map((r) => {
            if (r.id !== roomId)
                return r;
            const last = r.last_message;
            if (last && new Date(msg.created_at).getTime() < new Date(last.created_at).getTime())
                return r;
            return { ...r, last_message: msg };
        }));
    }, []);

    const patchMessageReactions = useCallback((roomId: number, messageId: number, reactions: ChatReaction[]) => {
        setMessagesByRoom((prev) => {
            const msgs = prev[roomId];
            if (!msgs)
                return prev;
            return {
                ...prev,
                [roomId]: msgs.map((m) =>
                    m.id === messageId ? { ...m, reactions } : m,
                ),
            };
        });
    }, []);

    useEffect(() => {
        return subscribeChatWs((event) => {
            if (event.type === 'poll_vote' || event.type === 'poll_closed') {
                const raw = event.payload?.message;
                if (!raw || typeof raw !== 'object')
                    return;
                const msg = parseChatMessageFromWsPayload(raw);
                if (!msg)
                    return;
                upsertRoomMessage(event.room_id, msg);
                return;
            }
            if (event.type === 'room_created') {
                invalidateChatRoomsCache();
                void refreshRooms();
                return;
            }
            if (event.type === 'message' || event.type === 'message_edited' || event.type === 'message_deleted') {
                const raw = event.payload?.message;
                if (!raw || typeof raw !== 'object')
                    return;
                const msg = parseChatMessageFromWsPayload(raw);
                if (!msg)
                    return;
                upsertRoomMessage(event.room_id, msg);
                if (event.type === 'message')
                    patchRoomInList(event.room_id, msg);
                if (event.room_id !== activeRoomId && event.type === 'message') {
                    setRooms((prev) => prev.map((r) => r.id === event.room_id
                        ? { ...r, unread_count: r.unread_count + 1, last_message: msg }
                        : r));
                }
                return;
            }
            if (event.type === 'reaction') {
                patchMessageReactions(event.room_id, event.messageId, event.reactions);
                return;
            }
            if (event.type === 'members_added') {
                invalidateChatRoomsCache();
                void refreshRooms();
            }
        });
    }, [activeRoomId, upsertRoomMessage, patchRoomInList, patchMessageReactions, refreshRooms]);

    const activeRoomIdRef = useRef(activeRoomId);
    activeRoomIdRef.current = activeRoomId;

    const markRoomReadUpToLatest = useCallback(async (roomId: number, messages: ChatMessage[]) => {
        if (activeRoomIdRef.current !== roomId)
            return;
        const last = messages[messages.length - 1];
        if (last)
            await markChatRoomRead(roomId, last.id);
        else
            await markChatRoomRead(roomId);
        setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, unread_count: 0 } : r));
    }, []);

    const loadMessages = useCallback(async (roomId: number) => {
        setMessagesLoading(true);
        setMessagesError(null);
        try {
            const { items, has_more } = await fetchChatMessages(roomId, {
                limit: MESSAGES_OLDER_BATCH,
            });
            setHasMoreOlderByRoom((prev) => ({ ...prev, [roomId]: has_more }));
            let mergedForRoom: ChatMessage[] = [];
            setMessagesByRoom((prev) => {
                const cached = prev[roomId] ?? [];
                const newestInBatch = items[items.length - 1]?.id ?? 0;
                const newerFromCache = cached.filter((m) => m.id > newestInBatch);
                mergedForRoom = mergeMessagesSorted(items, newerFromCache);
                return {
                    ...prev,
                    [roomId]: mergedForRoom,
                };
            });
            await markRoomReadUpToLatest(roomId, mergedForRoom);
        }
        catch (e: unknown) {
            if (activeRoomIdRef.current === roomId) {
                setMessagesError(e instanceof Error ? e.message : 'Не удалось загрузить сообщения');
            }
        }
        finally {
            setMessagesLoading(false);
        }
    }, [markRoomReadUpToLatest]);

    const prefetchedRoomsRef = useRef(new Set<number>());

    const prefetchRoomMessages = useCallback((roomId: number) => {
        if (prefetchedRoomsRef.current.has(roomId))
            return;
        prefetchedRoomsRef.current.add(roomId);
        void fetchChatMessages(roomId, { limit: MESSAGES_OLDER_BATCH }).then(({ items, has_more }) => {
            setHasMoreOlderByRoom((prev) => ({ ...prev, [roomId]: has_more }));
            setMessagesByRoom((prev) => {
                if (prev[roomId]?.length)
                    return prev;
                return { ...prev, [roomId]: items };
            });
        }).catch(() => {
            prefetchedRoomsRef.current.delete(roomId);
        });
    }, []);

    const loadingOlderRef = useRef(false);

    const loadOlderMessages = useCallback(async (roomId: number) => {
        if (loadingOlderRef.current)
            return false;
        const current = messagesByRoom[roomId];
        if (!current?.length || !hasMoreOlderByRoom[roomId])
            return false;
        const beforeId = current[0]?.id;
        if (beforeId == null)
            return false;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const { items, has_more } = await fetchChatMessages(roomId, {
                beforeId,
                limit: MESSAGES_OLDER_BATCH,
            });
            setHasMoreOlderByRoom((prev) => ({ ...prev, [roomId]: has_more }));
            if (items.length === 0)
                return false;
            setMessagesByRoom((prev) => ({
                ...prev,
                [roomId]: mergeMessagesSorted(items, prev[roomId] ?? []),
            }));
            return true;
        }
        catch {
            return false;
        }
        finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, [hasMoreOlderByRoom, messagesByRoom]);

    useEffect(() => {
        if (activeRoomId == null)
            return;
        void loadMessages(activeRoomId);
    }, [activeRoomId, loadMessages]);

    const activeRoom = useMemo(
        () => (activeRoomId != null ? rooms.find((r) => r.id === activeRoomId) ?? null : null),
        [rooms, activeRoomId],
    );

    const activePreview = useMemo(
        () => (activeRoom ? roomToPreview(activeRoom, userId ?? null, labelByUserId) : null),
        [activeRoom, userId, labelByUserId],
    );

    const serviceText = activeRoom?.is_company_channel ? COMPANY_CHANNEL_HINT : '';

    const apiMessages = activeRoomId != null ? (messagesByRoom[activeRoomId] ?? []) : [];

    const dailyMessages: DailyMessage[] = useMemo(
        () => apiMessages.map((m) => apiMessageToDaily(m, labelByUserId, userId ?? null)),
        [apiMessages, labelByUserId, userId],
    );

    const isOwn = useCallback(
        (m: DailyMessage) => m.authorId != null && userId != null && m.authorId === userId,
        [userId],
    );

    const blocks: RenderBlock[] = useMemo(
        () => buildRenderBlocks(dailyMessages, serviceText, String(activeRoomId ?? ''), isOwn),
        [dailyMessages, serviceText, activeRoomId, isOwn],
    );

    const chatPreviews: ChatPreview[] = useMemo(
        () => rooms.map((r) => roomToPreview(r, userId ?? null, labelByUserId)),
        [rooms, userId, labelByUserId],
    );

    const unreadByChat = useMemo(() => {
        const out: Record<string, number> = {};
        for (const r of rooms) {
            if (r.unread_count > 0)
                out[String(r.id)] = r.unread_count;
        }
        return out;
    }, [rooms]);

    const memberCountLabel = useMemo(() => {
        if (!activeRoom)
            return '';
        if (activeRoom.is_company_channel) {
            if (employees.length === 0)
                return 'общий чат';
            const n = employees.length;
            return `${n} ${n === 1 ? 'участник' : n < 5 ? 'участника' : 'участников'}`;
        }
        return roomSubtitle(activeRoom);
    }, [activeRoom, employees.length]);

    const selectRoom = useCallback((roomId: number) => {
        setActiveRoomId(roomId);
        setSendError(null);
        setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, unread_count: 0 } : r));
    }, []);

    const sendMessage = useCallback(async (body: string, replyToMessageId?: number) => {
        if (activeRoomId == null)
            return;
        const text = body.trim();
        if (!text)
            return;
        setSending(true);
        setSendError(null);
        try {
            const msg = await postChatMessage(activeRoomId, text, replyToMessageId);
            upsertRoomMessage(activeRoomId, msg);
            patchRoomInList(activeRoomId, msg);
            await markChatRoomRead(activeRoomId, msg.id);
            setRooms((prev) => prev.map((r) => r.id === activeRoomId
                ? { ...r, unread_count: 0, last_message: msg }
                : r));
        }
        catch (e: unknown) {
            setSendError(e instanceof Error ? e.message : 'Не удалось отправить сообщение');
        }
        finally {
            setSending(false);
        }
    }, [activeRoomId, upsertRoomMessage, patchRoomInList]);

    const sendFile = useCallback(async (file: File, caption?: string, replyToMessageId?: number) => {
        if (activeRoomId == null)
            return;
        setSending(true);
        setSendError(null);
        try {
            const msg = await uploadChatFile(activeRoomId, file, {
                body: caption,
                replyToMessageId,
            });
            upsertRoomMessage(activeRoomId, msg);
            patchRoomInList(activeRoomId, msg);
            await markChatRoomRead(activeRoomId, msg.id);
            setRooms((prev) => prev.map((r) => r.id === activeRoomId
                ? { ...r, unread_count: 0, last_message: msg }
                : r));
        }
        catch (e: unknown) {
            setSendError(e instanceof Error ? e.message : 'Не удалось отправить файл');
        }
        finally {
            setSending(false);
        }
    }, [activeRoomId, upsertRoomMessage, patchRoomInList]);

    const toggleReaction = useCallback(async (messageId: number, emoji: string) => {
        try {
            const reactions = await toggleChatReaction(messageId, emoji);
            if (activeRoomId != null) {
                patchMessageReactions(activeRoomId, messageId, reactions);
            }
        }
        catch {
        }
    }, [activeRoomId, patchMessageReactions]);

    const createGroupRoom = useCallback(async (title: string, memberUserIds: number[]) => {
        const room = await createChatGroupRoom(title, memberUserIds);
        await refreshRooms();
        selectRoom(room.id);
        return room.id;
    }, [refreshRooms, selectRoom]);

    const createChannelRoom = useCallback(async (title: string, memberUserIds: number[]) => {
        const room = await createChatChannelRoom(title, memberUserIds);
        await refreshRooms();
        selectRoom(room.id);
        return room.id;
    }, [refreshRooms, selectRoom]);

    const createPoll = useCallback(async (input: CreatePollInput) => {
        if (activeRoomId == null)
            return;
        setSending(true);
        setSendError(null);
        try {
            const msg = await createChatPoll(activeRoomId, input);
            upsertRoomMessage(activeRoomId, msg);
            patchRoomInList(activeRoomId, msg);
            await markChatRoomRead(activeRoomId, msg.id);
        }
        catch (e: unknown) {
            setSendError(e instanceof Error ? e.message : 'Не удалось создать опрос');
            throw e;
        }
        finally {
            setSending(false);
        }
    }, [activeRoomId, upsertRoomMessage, patchRoomInList]);

    const votePoll = useCallback(async (pollId: number, optionIndex: number) => {
        try {
            const msg = await voteChatPoll(pollId, optionIndex);
            upsertRoomMessage(msg.room_id, msg);
        }
        catch {

        }
    }, [upsertRoomMessage]);

    const closePoll = useCallback(async (pollId: number) => {
        try {
            const msg = await closeChatPoll(pollId);
            upsertRoomMessage(msg.room_id, msg);
        }
        catch {

        }
    }, [upsertRoomMessage]);

    const deleteMessage = useCallback(async (messageId: number) => {
        try {
            const msg = await deleteChatMessage(messageId);
            upsertRoomMessage(msg.room_id, msg);
            patchRoomInList(msg.room_id, msg);
        }
        catch {

        }
    }, [upsertRoomMessage, patchRoomInList]);

    const openDmWithUser = useCallback(async (otherUserId: number) => {
        try {
            const room = await createOrGetChatDmRoom(otherUserId);
            await refreshRooms();
            selectRoom(room.id);
            return room.id;
        }
        catch (e: unknown) {
            setRoomsError(e instanceof Error ? e.message : 'Не удалось открыть личный чат');
            return null;
        }
    }, [refreshRooms, selectRoom]);

    const initialPaneLoading = roomsLoading
        || (activeRoomId != null && messagesLoading && messagesByRoom[activeRoomId] === undefined);

    const hasMoreOlder = activeRoomId != null && (hasMoreOlderByRoom[activeRoomId] ?? false);

    return {
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
        refreshRooms,
        toggleReaction,
        deleteMessage,
        createGroupRoom,
        createChannelRoom,
        createPoll,
        votePoll,
        closePoll,
        canPost: activeRoom?.is_company_channel || activeRoom?.room_type === 'group' || activeRoom?.room_type === 'dm'
            ? true
            : (activeRoom?.can_post ?? true),
        resolveRoomTitle: (room: ChatRoom) => resolveRoomTitle(room, userId ?? null, labelByUserId),
    };
}
