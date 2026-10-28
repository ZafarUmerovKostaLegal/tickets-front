let handlers = null;
export function registerAppDialogHandlers(next) {
    handlers = next;
}
export function showAlert(opts) {
    return handlers?.showAlert(opts) ?? Promise.resolve();
}
export function showConfirm(opts) {
    return handlers?.showConfirm(opts) ?? Promise.resolve(false);
}
