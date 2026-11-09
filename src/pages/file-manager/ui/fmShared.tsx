import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import type { AccessLevel, AclLevel, FileKind } from '../api/filesApi';
import { errorText } from '../api/filesApi';
import { fmt } from '../lib/filesFormat';

export function useFm() {
    const { t, locale } = useI18n();
    const tr = useCallback((key: string, vars?: Record<string, string | number>) => {
        const text = t(`fileManagerPage.${key}` as TranslationKey);
        return vars ? fmt(text, vars) : text;
    }, [t]);
    return { tr, locale };
}

export type IconName =
    | 'building' | 'briefcase' | 'folder' | 'folderOpen' | 'star' | 'clock' | 'lock' | 'search' | 'trash'
    | 'inbox' | 'shield' | 'grid' | 'list' | 'pulse' | 'template' | 'upload' | 'download' | 'plus' | 'chevron'
    | 'close' | 'link' | 'edit' | 'restore' | 'eye' | 'user' | 'check' | 'x' | 'key'
    | 'up' | 'back' | 'refresh' | 'home' | 'sort';

const PATHS: Record<IconName, ReactNode> = {
    building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></>,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    folderOpen: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1H7.5a2 2 0 0 0-1.9 1.4L3.5 18M3.5 18 6 11h15l-2.4 6.6a2 2 0 0 1-1.9 1.4H5a2 2 0 0 1-1.5-1" />,
    star: <path d="m12 4 2.3 4.7 5.2.8-3.8 3.6.9 5.2L12 15.9l-4.6 2.4.9-5.2-3.8-3.6 5.2-.8z" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
    trash: <><path d="M4.5 7h15M9.5 7V5h5v2" /><path d="M6.5 7l1 13h9l1-13" /></>,
    inbox: <><path d="M3 13h5l2 3h4l2-3h5v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M4 13 6 5h12l2 8" /></>,
    shield: <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6z" />,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    list: <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />,
    pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
    template: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></>,
    upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
    download: <path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
    restore: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.5" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
    up: <path d="M12 19V5M7 10l5-5 5 5" />,
    back: <path d="M19 12H5M10 7l-5 5 5 5" />,
    refresh: <path d="M20 12a8 8 0 1 1-2.2-5.5M20 4v5h-5" />,
    home: <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />,
    sort: <path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
    return (
        <svg className={className ? `fm-ico ${className}` : 'fm-ico'} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {PATHS[name]}
        </svg>
    );
}

const KIND_LABEL: Record<FileKind, string> = {
    pdf: 'PDF', doc: 'DOC', sheet: 'XLS', slides: 'PPT', email: 'MSG', image: 'IMG', archive: 'ZIP', text: 'TXT', file: 'FILE',
};

export function FileBadge({ kind }: { kind: FileKind }) {
    return <span className={`fm-kind fm-kind--${kind}`} aria-hidden>{KIND_LABEL[kind]}</span>;
}

export function LevelBadge({ level }: { level: AccessLevel | AclLevel }) {
    const { tr } = useFm();
    return <span className={`fm-level fm-level--${level}`}>{tr(`levels.${level}`)}</span>;
}

export type Loadable<T> = {
    data: T | null;
    error: string | null;
    loading: boolean;
    reload: () => void;
    setData: (updater: (prev: T | null) => T | null) => void;
};

export function useLoad<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]): Loadable<T> {
    const { tr } = useFm();
    const [data, setDataState] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(load !== null);
    const [tick, setTick] = useState(0);
    const loadRef = useRef(load);
    loadRef.current = load;

    useEffect(() => {
        const run = loadRef.current;
        if (run === null) {
            setLoading(false);
            return;
        }
        let alive = true;
        setLoading(true);
        setError(null);
        run().then((value) => {
            if (alive)
                setDataState(value);
        }, (err: unknown) => {
            if (alive)
                setError(errorText(err, tr('common.error')));
        }).finally(() => {
            if (alive)
                setLoading(false);
        });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, tick]);

    const reload = useCallback(() => setTick((n) => n + 1), []);
    const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(updater), []);
    return { data, error, loading, reload, setData };
}

export function StateBlock({ loading, error, onRetry, empty, children }: {
    loading: boolean;
    error: string | null;
    onRetry?: () => void;
    empty?: ReactNode;
    children?: ReactNode;
}) {
    const { tr } = useFm();
    if (error) {
        return (
            <div className="fm-state fm-state--error">
                <p>{error}</p>
                {onRetry ? <button type="button" className="fm-btn" onClick={onRetry}>{tr('common.retry')}</button> : null}
            </div>
        );
    }
    if (loading)
        return <div className="fm-state"><span className="fm-spinner" aria-hidden />{tr('common.loading')}</div>;
    if (empty)
        return <div className="fm-state">{empty}</div>;
    return <>{children}</>;
}

export function Modal({ title, onClose, children, footer, wide }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}) {
    const { tr } = useFm();
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(
        <div className="fm-modal" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
            <div className={wide ? 'fm-modal__card is-wide' : 'fm-modal__card'} role="dialog" aria-modal="true" aria-label={title}>
                <header>
                    <h3>{title}</h3>
                    <button type="button" className="fm-icon-btn" aria-label={tr('common.close')} onClick={onClose}><Icon name="close" /></button>
                </header>
                <div className="fm-modal__body">{children}</div>
                {footer ? <footer>{footer}</footer> : null}
            </div>
        </div>,
        document.body,
    );
}

export function ConfirmModal({ title, text, confirmLabel, danger, onConfirm, onClose }: {
    title: string;
    text: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void> | void;
    onClose: () => void;
}) {
    const { tr } = useFm();
    const [busy, setBusy] = useState(false);
    return (
        <Modal title={title} onClose={onClose} footer={(
            <>
                <button type="button" className="fm-btn" onClick={onClose}>{tr('common.cancel')}</button>
                <button type="button" className={danger ? 'fm-btn fm-btn--danger' : 'fm-btn fm-btn--primary'} disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await onConfirm();
                            onClose();
                        }
                        finally {
                            setBusy(false);
                        }
                    }}>{confirmLabel}</button>
            </>
        )}>
            <p className="fm-modal__text">{text}</p>
        </Modal>
    );
}

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
type Notify = (text: string, tone?: Toast['tone']) => void;

const ToastContext = createContext<Notify>(() => {});

export function ToastHost({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const seq = useRef(0);
    const notify = useCallback<Notify>((text, tone = 'ok') => {
        seq.current += 1;
        const id = seq.current;
        setToasts((list) => [...list.slice(-3), { id, text, tone }]);
        window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), tone === 'error' ? 6000 : 3200);
    }, []);
    return (
        <ToastContext.Provider value={notify}>
            {children}
            <div className="fm-toasts" aria-live="polite">
                {toasts.map((toast) => <div key={toast.id} className={`fm-toast fm-toast--${toast.tone}`}>{toast.text}</div>)}
            </div>
        </ToastContext.Provider>
    );
}

export function useNotify(): Notify {
    return useContext(ToastContext);
}

export function useAction() {
    const notify = useNotify();
    const { tr } = useFm();
    return useCallback(async <T,>(run: () => Promise<T>, okText?: string): Promise<T | undefined> => {
        try {
            const result = await run();
            if (okText)
                notify(okText);
            return result;
        }
        catch (err) {
            notify(errorText(err, tr('errors.action')), 'error');
            return undefined;
        }
    }, [notify, tr]);
}

export async function saveBlob(blob: Blob, name: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
