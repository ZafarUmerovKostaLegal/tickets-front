import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { TODO_NOTIFICATION_TYPES } from '@entities/notification/wsClient';
import { getCorrespondenceOutgoingUrl, getExpensesOpenUrl, getTicketDetailUrl, routes } from '@shared/config';
import { AuthImg, navigateWithTransition } from '@shared/ui';
function ticketUuidFromNotification(notification) {
    const blob = `${notification.title} ${notification.description}`;
    const match = /ticket:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(blob);
    return match?.[1] ?? null;
}
function correspondenceOpenUrl(notificationType) {
    if (notificationType === 'correspondence_review')
        return `${getCorrespondenceOutgoingUrl()}&view=attention`;
    if (notificationType === 'correspondence_incoming')
        return `${routes.correspondence}?view=attention`;
    if (notificationType === 'correspondence_registered' || notificationType === 'correspondence_rejected')
        return getCorrespondenceOutgoingUrl();
    if (notificationType === 'correspondence')
        return routes.correspondence;
    return null;
}
function notificationGoTarget(notification) {
    const kind = (notification.notification_type ?? '').trim().toLowerCase();
    if (kind === 'expense_payment_confirmation') {
        const match = /заявк[аи]\s+([\p{L}\p{N}_/-]+)/iu.exec(`${notification.title} ${notification.description}`);
        if (match?.[1])
            return { to: `${getExpensesOpenUrl(match[1])}?intent=pay`, label: 'Перейти к заявке' };
        return { to: `${routes.expenses}?focus=pay`, label: 'Показать к оплате' };
    }
    if (kind.includes('expense') && (kind.includes('approv') || kind.includes('moderat')))
        return { to: routes.expenses, label: 'К расходам' };
    const correspondenceUrl = correspondenceOpenUrl(kind);
    if (correspondenceUrl)
        return { to: correspondenceUrl, label: 'Открыть корреспонденцию' };
    if (kind === 'ticket_approval' || kind === 'ticket_approved' || kind === 'ticket_rejected' || kind.startsWith('ticket_')) {
        const uuid = ticketUuidFromNotification(notification);
        if (uuid)
            return { to: getTicketDetailUrl(uuid), label: 'Открыть заявку' };
        return { to: routes.tickets, label: 'К IT-заявкам' };
    }
    if (kind === TODO_NOTIFICATION_TYPES.boardInvited)
        return { to: `${routes.todo}?invites=1`, label: 'Открыть приглашения' };
    if (kind === TODO_NOTIFICATION_TYPES.boardAdded || kind === TODO_NOTIFICATION_TYPES.cardAssigned)
        return { to: routes.todo, label: 'Открыть список дел' };
    if (kind.includes('vacation') || kind.includes('leave_request'))
        return { to: `${routes.vacationSchedule}?tab=to_decide`, label: 'Перейти к согласованию' };
    if (kind.includes('for_review') || kind.includes('partner_confirm'))
        return { to: `${routes.timeTracking}?tab=reports&reportsSection=for-review`, label: 'Открыть отчёты' };
    return null;
}
export const NotificationDetailModal = memo(function NotificationDetailModal({ notification, onClose }) {
    const navigate = useNavigate();
    const go = notificationGoTarget(notification);
    const openTarget = () => {
        if (!go)
            return;
        onClose();
        navigateWithTransition(navigate, go.to);
    };
    const modal = (_jsxs("div", { className: "tm", role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: "tm__backdrop", "aria-hidden": true }), _jsxs("div", { className: "tm__box", children: [_jsxs("div", { className: "tm__head", children: [_jsxs("div", { className: "tm__head-left", children: [_jsx("span", { className: "tm__head-icon tm__head-icon--bell", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }), _jsx("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })] }) }), _jsx("h2", { className: "tm__title", children: "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435" })] }), _jsx("button", { type: "button", className: "tm__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "tm__body", children: [_jsx("h3", { className: "tm__body-title", children: notification.title }), _jsxs("div", { className: "tm__body-meta", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }), _jsx("span", { children: new Date(notification.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) }), _jsx("span", { className: "tm__body-dot" }), _jsx("span", { children: new Date(notification.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })] }), _jsx("div", { className: "tm__body-text", children: notification.description || notification.title }), notification.photo_path && (_jsx("div", { className: "tm__body-photo", children: _jsx(AuthImg, { mediaPath: notification.photo_path, alt: "", className: "tm__body-img" }) }))] }), _jsxs("div", { className: "tm__foot", children: [_jsx("button", { type: "button", className: "tm__btn tm__btn--ghost", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }), go ? (_jsxs("button", { type: "button", className: "tm__btn tm__btn--primary", onClick: openTarget, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M5 12h14" }), _jsx("path", { d: "m12 5 7 7-7 7" })] }), go.label] })) : null] })] })] }));
    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
});
