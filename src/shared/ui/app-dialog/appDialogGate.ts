export type ShowAlertOptions = {
    title?: string;
    message: string;
};

export type ShowConfirmOptions = {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
};

export type AppDialogHandlers = {
    showAlert: (opts: ShowAlertOptions) => Promise<void>;
    showConfirm: (opts: ShowConfirmOptions) => Promise<boolean>;
};

let handlers: AppDialogHandlers | null = null;

export function registerAppDialogHandlers(next: AppDialogHandlers | null): void {
    handlers = next;
}

export function showAlert(opts: ShowAlertOptions): Promise<void> {
    return handlers?.showAlert(opts) ?? Promise.resolve();
}

export function showConfirm(opts: ShowConfirmOptions): Promise<boolean> {
    return handlers?.showConfirm(opts) ?? Promise.resolve(false);
}
