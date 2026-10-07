import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { acceptTodoInvite, declineTodoInvite, fetchMyTodoInvites, invalidateTodoInvites, } from '@entities/todo';
import { useI18n } from '@shared/i18n';
export function TodoInvitesPanel({ open, onOpenChange, onAccepted, onInvitesChanged }) {
    const { t } = useI18n();
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const reload = useCallback(() => {
        setLoading(true);
        setError(null);
        return fetchMyTodoInvites()
            .then((list) => {
            setInvites(list.filter((i) => (i.status || '').toLowerCase() === 'pending'));
        })
            .catch((e) => {
            setInvites([]);
            setError(e instanceof Error ? e.message : t('todoPage.errors.load'));
        })
            .finally(() => setLoading(false));
    }, [t]);
    useEffect(() => {
        void reload();
    }, [reload]);
    useEffect(() => {
        if (open)
            void reload();
    }, [open, reload]);
    const pendingCount = invites.length;
    const handleAccept = async (invite) => {
        setBusyId(invite.id);
        setError(null);
        try {
            const board = await acceptTodoInvite(invite.id);
            await onAccepted(board);
            await reload();
            invalidateTodoInvites();
            onInvitesChanged?.();
            onOpenChange(false);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('todoPage.invites.acceptError'));
        }
        finally {
            setBusyId(null);
        }
    };
    const handleDecline = async (invite) => {
        setBusyId(invite.id);
        setError(null);
        try {
            await declineTodoInvite(invite.id);
            await reload();
            invalidateTodoInvites();
            onInvitesChanged?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('todoPage.invites.declineError'));
        }
        finally {
            setBusyId(null);
        }
    };
    const modal = open && typeof document !== 'undefined'
        ? createPortal(_jsx("div", { className: "todo-invites__backdrop", onClick: () => onOpenChange(false), children: _jsxs("div", { className: "todo-invites__modal", onClick: (e) => e.stopPropagation(), role: "dialog", "aria-labelledby": "todo-invites-title", children: [_jsxs("div", { className: "todo-invites__head", children: [_jsx("h2", { id: "todo-invites-title", className: "todo-invites__title", children: t('todoPage.invites.title') }), _jsx("button", { type: "button", className: "todo-invites__close", onClick: () => onOpenChange(false), "aria-label": t('todoPage.close'), children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), error && _jsx("p", { className: "todo-invites__error", role: "alert", children: error }), loading && _jsx("p", { className: "todo-invites__status", children: t('todoPage.loading') }), !loading && invites.length === 0 && (_jsx("p", { className: "todo-invites__status", children: t('todoPage.invites.empty') })), _jsx("ul", { className: "todo-invites__list", children: invites.map((inv) => (_jsxs("li", { className: "todo-invites__item", children: [_jsxs("div", { className: "todo-invites__item-main", children: [_jsx("span", { className: "todo-invites__board", children: inv.board_title || `#${inv.board_id}` }), _jsx("span", { className: "todo-invites__role", children: t('todoPage.invites.roleOffered').replace('{role}', inv.role_offered) })] }), _jsxs("div", { className: "todo-invites__actions", children: [_jsx("button", { type: "button", className: "todo-invites__btn todo-invites__btn--primary", disabled: busyId != null, onClick: () => void handleAccept(inv), children: busyId === inv.id ? t('todoPage.loading') : t('todoPage.invites.accept') }), _jsx("button", { type: "button", className: "todo-invites__btn todo-invites__btn--ghost", disabled: busyId != null, onClick: () => void handleDecline(inv), children: t('todoPage.invites.decline') })] })] }, inv.id))) })] }) }), document.body)
        : null;
    return (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: `todo-page__header-btn${open ? ' todo-page__header-btn--active' : ''}`, onClick: () => onOpenChange(!open), "aria-expanded": open, children: [_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }), _jsx("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })] }), _jsx("span", { children: t('todoPage.invites.nav') }), pendingCount > 0 && _jsx("span", { className: "todo-page__header-badge", children: pendingCount })] }), modal] }));
}
