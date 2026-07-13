export type ChatNotificationContext = {
    onKostaDailyPage: boolean;
    activeRoomId: number | null;
};

let context: ChatNotificationContext = {
    onKostaDailyPage: false,
    activeRoomId: null,
};

export function setChatNotificationContext(patch: Partial<ChatNotificationContext>): void {
    context = { ...context, ...patch };
}

export function getChatNotificationContext(): ChatNotificationContext {
    return context;
}
