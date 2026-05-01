export type ToastVariant = 'error' | 'warning' | 'info' | 'success';

export type PushToastOptions = {
    message: string;
    variant?: ToastVariant;
    /** По умолчанию 6500 мс */
    durationMs?: number;
};

export type AppToastHandlers = {
    pushToast: (opts: PushToastOptions) => void;
};

let handlers: AppToastHandlers | null = null;

export function registerAppToastHandlers(next: AppToastHandlers | null): void {
    handlers = next;
}

/** Вне React (таймеры и т.п.). Ничего не делает, если провайдер ещё не смонтирован. */
export function showToast(opts: PushToastOptions): void {
    handlers?.pushToast(opts);
}
