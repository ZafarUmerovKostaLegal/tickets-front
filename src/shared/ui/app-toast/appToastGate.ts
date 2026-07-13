export type ToastVariant = 'error' | 'warning' | 'info' | 'success';

export type PushToastOptions = {
    message: string;
    variant?: ToastVariant;

    durationMs?: number;
};

export type AppToastHandlers = {
    pushToast: (opts: PushToastOptions) => void;
};

let handlers: AppToastHandlers | null = null;

export function registerAppToastHandlers(next: AppToastHandlers | null): void {
    handlers = next;
}


export function showToast(opts: PushToastOptions): void {
    handlers?.pushToast(opts);
}
