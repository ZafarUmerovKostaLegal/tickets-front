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

let windowInFront = typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && document.hasFocus();

function syncWindowInFront(): void {
    windowInFront = document.visibilityState === 'visible' && document.hasFocus();
}

if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => {
        windowInFront = false;
    });
    window.addEventListener('focus', syncWindowInFront);
    document.addEventListener('visibilitychange', syncWindowInFront);
}

export function chatWindowIsInFront(): boolean {
    return windowInFront;
}
