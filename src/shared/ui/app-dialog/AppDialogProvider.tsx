import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { registerAppDialogHandlers, type ShowAlertOptions, type ShowConfirmOptions } from './appDialogGate';
import './AppDialog.css';

type AlertQueueEntry = ShowAlertOptions & {
    kind: 'alert';
    resolve: () => void;
};

type ConfirmQueueEntry = ShowConfirmOptions & {
    kind: 'confirm';
    resolve: (value: boolean) => void;
};

type QueueEntry = AlertQueueEntry | ConfirmQueueEntry;

export type UseAppDialogResult = {
    showAlert: (opts: ShowAlertOptions) => Promise<void>;
    showConfirm: (opts: ShowConfirmOptions) => Promise<boolean>;
};

const AppDialogContext = createContext<UseAppDialogResult | null>(null);

export function useAppDialog(): UseAppDialogResult {
    const v = useContext(AppDialogContext);
    if (!v)
        throw new Error('useAppDialog: оберните приложение в AppDialogProvider');
    return v;
}

function AppDialogModal({ entry, onFinish }: {
    entry: QueueEntry;
    onFinish: () => void;
}) {
    const titleId = useId();
    const descId = useId();

    const finishAlert = useCallback(() => {
        if (entry.kind === 'alert')
            entry.resolve();
        onFinish();
    }, [entry, onFinish]);

    const finishConfirm = useCallback((value: boolean) => {
        if (entry.kind === 'confirm')
            entry.resolve(value);
        onFinish();
    }, [entry, onFinish]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (entry.kind === 'alert')
                    finishAlert();
                else
                    finishConfirm(false);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (entry.kind === 'alert')
                    finishAlert();
                else
                    finishConfirm(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [entry.kind, finishAlert, finishConfirm]);

    const titleText = entry.title ?? (entry.kind === 'confirm' ? 'Подтвердите действие' : 'Сообщение');

    const backdropClick = () => {
        if (entry.kind === 'alert')
            finishAlert();
        else
            finishConfirm(false);
    };

    return createPortal(<div className="app-dlg" role="presentation" onClick={backdropClick}>
        <div className="app-dlg__panel" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} onClick={(e) => e.stopPropagation()}>
            <h2 className="app-dlg__title" id={titleId}>
                {titleText}
            </h2>
            <p className="app-dlg__text" id={descId}>
                {entry.message}
            </p>
            <div className="app-dlg__actions">
                {entry.kind === 'confirm'
                    ? (<>
                        <button type="button" className="app-dlg__btn" onClick={() => finishConfirm(false)} autoFocus>
                            {entry.cancelLabel ?? 'Отмена'}
                        </button>
                        <button type="button" className={[
                                'app-dlg__btn',
                                entry.variant === 'danger' ? 'app-dlg__btn--danger' : 'app-dlg__btn--primary',
                            ].join(' ')} onClick={() => finishConfirm(true)}>
                            {entry.confirmLabel ?? 'Подтвердить'}
                        </button>
                      </>)
                    : (<button type="button" className="app-dlg__btn app-dlg__btn--primary" onClick={finishAlert} autoFocus>
                        Понятно
                      </button>)}
            </div>
        </div>
    </div>, document.body);
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
    const [queue, setQueue] = useState<QueueEntry[]>([]);

    const showAlert = useCallback((opts: ShowAlertOptions) => {
        return new Promise<void>((resolve) => {
            setQueue((q) => [...q, {
                    kind: 'alert',
                    title: opts.title,
                    message: opts.message,
                    resolve,
                }]);
        });
    }, []);

    const showConfirm = useCallback((opts: ShowConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setQueue((q) => [...q, {
                    kind: 'confirm',
                    title: opts.title,
                    message: opts.message,
                    confirmLabel: opts.confirmLabel,
                    cancelLabel: opts.cancelLabel,
                    variant: opts.variant ?? 'default',
                    resolve,
                }]);
        });
    }, []);

    useEffect(() => {
        registerAppDialogHandlers({ showAlert, showConfirm });
        return () => registerAppDialogHandlers(null);
    }, [showAlert, showConfirm]);

    const ctx = useMemo((): UseAppDialogResult => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

    const head = queue[0];

    const popHead = useCallback(() => {
        setQueue((q) => q.slice(1));
    }, []);

    return (<AppDialogContext.Provider value={ctx}>
        {children}
        {head ? <AppDialogModal entry={head} onFinish={popHead} /> : null}
      </AppDialogContext.Provider>);
}
