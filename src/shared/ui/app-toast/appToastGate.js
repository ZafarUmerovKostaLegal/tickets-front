let handlers = null;
export function registerAppToastHandlers(next) {
    handlers = next;
}
export function showToast(opts) {
    handlers?.pushToast(opts);
}
