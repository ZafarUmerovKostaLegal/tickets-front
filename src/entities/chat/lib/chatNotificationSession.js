let context = {
    onKostaDailyPage: false,
    activeRoomId: null,
};
export function setChatNotificationContext(patch) {
    context = { ...context, ...patch };
}
export function getChatNotificationContext() {
    return context;
}
let windowInFront = typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && document.hasFocus();
function syncWindowInFront() {
    windowInFront = document.visibilityState === 'visible' && document.hasFocus();
}
if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => {
        windowInFront = false;
    });
    window.addEventListener('focus', syncWindowInFront);
    document.addEventListener('visibilitychange', syncWindowInFront);
}
export function chatWindowIsInFront() {
    return windowInFront;
}
