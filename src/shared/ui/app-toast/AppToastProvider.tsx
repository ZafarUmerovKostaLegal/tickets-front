import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { registerAppToastHandlers, type PushToastOptions, type ToastVariant } from './appToastGate';
import './AppToast.css';

type ToastItem = {
    id: string;
    message: string;
    variant: ToastVariant;
};

type Ctx = {
    pushToast: (opts: PushToastOptions) => void;
};

const AppToastContext = createContext<Ctx | null>(null);

export function useAppToast(): Ctx {
    const v = useContext(AppToastContext);
    if (!v)
        throw new Error('useAppToast must be used within AppToastProvider');
    return v;
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
    if (variant === 'success') {
        return (<svg className="app-toast__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20 6L9 17l-5-5"/>
        </svg>);
    }
    if (variant === 'error') {
        return (<svg className="app-toast__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6"/>
        </svg>);
    }
    if (variant === 'warning') {
        return (<svg className="app-toast__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>);
    }
    return (<svg className="app-toast__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>);
}

export function AppToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const lastPushRef = useRef<{ message: string; at: number } | null>(null);
    const remove = useCallback((id: string) => {
        setItems((q) => q.filter((x) => x.id !== id));
    }, []);
    const pushToast = useCallback((opts: PushToastOptions) => {
        const variant = opts.variant ?? 'info';
        const durationMs = opts.durationMs ?? 6500;
        const message = String(opts.message ?? '').trim();
        if (!message)
            return;
        const now = Date.now();
        const prev = lastPushRef.current;
        if (prev && prev.message === message && now - prev.at < 450)
            return;
        lastPushRef.current = { message, at: now };
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        let scheduled = false;
        setItems((q) => {
            if (q.some((x) => x.message === message))
                return q;
            scheduled = true;
            return [...q, { id, message, variant }];
        });
        if (scheduled) {
            window.setTimeout(() => {
                remove(id);
            }, durationMs);
        }
    }, [remove]);
    useEffect(() => {
        registerAppToastHandlers({ pushToast });
        return () => registerAppToastHandlers(null);
    }, [pushToast]);
    const ctx = useMemo(() => ({ pushToast }), [pushToast]);
    const stack = (<div className="app-toast-host" aria-live="polite" aria-relevant="additions text">
      {items.map((t) => (<div key={t.id} className={`app-toast app-toast--${t.variant}`} role="status">
          <span className="app-toast__glyph" aria-hidden>
            <ToastIcon variant={t.variant} />
          </span>
          <p className="app-toast__msg">{t.message}</p>
          <button type="button" className="app-toast__close" onClick={() => remove(t.id)} aria-label="Закрыть уведомление">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>))}
    </div>);
    return (<AppToastContext.Provider value={ctx}>
      {children}
      {typeof document !== 'undefined' ? createPortal(stack, document.body) : null}
    </AppToastContext.Provider>);
}
