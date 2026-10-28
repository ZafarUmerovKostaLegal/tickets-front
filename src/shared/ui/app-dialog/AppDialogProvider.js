import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isLikelyStaleBundleErrorMessage, reloadForStaleBundle, STALE_BUNDLE_USER_MESSAGE, STALE_BUNDLE_USER_TITLE, } from '@app/lib/staleBundleError';
import { registerAppDialogHandlers } from './appDialogGate';
import './AppDialog.css';
const AppDialogContext = createContext(null);
export function useAppDialog() {
    const v = useContext(AppDialogContext);
    if (!v)
        throw new Error('useAppDialog: оберните приложение в AppDialogProvider');
    return v;
}
function AppDialogModal({ entry, onFinish }) {
    const titleId = useId();
    const descId = useId();
    const finishAlert = useCallback(() => {
        if (entry.kind === 'alert') {
            entry.resolve();
            if (entry.reloadOnClose)
                reloadForStaleBundle();
        }
        onFinish();
    }, [entry, onFinish]);
    const finishConfirm = useCallback((value) => {
        if (entry.kind === 'confirm')
            entry.resolve(value);
        onFinish();
    }, [entry, onFinish]);
    useEffect(() => {
        const onKey = (e) => {
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
    const actionLabel = entry.kind === 'alert' && entry.reloadOnClose ? 'Обновить' : 'Понятно';
    const backdropClick = () => {
        if (entry.kind === 'alert')
            finishAlert();
        else
            finishConfirm(false);
    };
    return createPortal(_jsx("div", { className: "app-dlg", role: "presentation", onClick: backdropClick, children: _jsxs("div", { className: "app-dlg__panel", role: "alertdialog", "aria-modal": "true", "aria-labelledby": titleId, "aria-describedby": descId, onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "app-dlg__title", id: titleId, children: titleText }), _jsx("p", { className: "app-dlg__text", id: descId, children: entry.message }), _jsx("div", { className: "app-dlg__actions", children: entry.kind === 'confirm'
                        ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "app-dlg__btn", onClick: () => finishConfirm(false), autoFocus: true, children: entry.cancelLabel ?? 'Отмена' }), _jsx("button", { type: "button", className: [
                                        'app-dlg__btn',
                                        entry.variant === 'danger' ? 'app-dlg__btn--danger' : 'app-dlg__btn--primary',
                                    ].join(' '), onClick: () => finishConfirm(true), children: entry.confirmLabel ?? 'Подтвердить' })] }))
                        : (_jsx("button", { type: "button", className: "app-dlg__btn app-dlg__btn--primary", onClick: finishAlert, autoFocus: true, children: actionLabel })) })] }) }), document.body);
}
export function AppDialogProvider({ children }) {
    const [queue, setQueue] = useState([]);
    const showAlert = useCallback((opts) => {
        return new Promise((resolve) => {
            const stale = isLikelyStaleBundleErrorMessage(opts.message);
            setQueue((q) => [...q, {
                    kind: 'alert',
                    title: stale ? STALE_BUNDLE_USER_TITLE : opts.title,
                    message: stale ? STALE_BUNDLE_USER_MESSAGE : opts.message,
                    reloadOnClose: stale,
                    resolve,
                }]);
        });
    }, []);
    const showConfirm = useCallback((opts) => {
        return new Promise((resolve) => {
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
    const ctx = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);
    const head = queue[0];
    const popHead = useCallback(() => {
        setQueue((q) => q.slice(1));
    }, []);
    return (_jsxs(AppDialogContext.Provider, { value: ctx, children: [children, head ? _jsx(AppDialogModal, { entry: head, onFinish: popHead }) : null] }));
}
