import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect } from 'react';
import { useI18n } from '@shared/i18n';
import { TimeUserRow as TimeUserRowComponent } from './TimeUserRow';
export function TimeUsersTable({ users, openActionsId, onActionsOpen, onActionsClose, onOpenProjectAccess, }) {
    const { t } = useI18n();
    const actionsMenuRef = useRef(null);
    useEffect(() => {
        if (openActionsId == null)
            return;
        const onDocClick = (e) => {
            if (actionsMenuRef.current?.contains(e.target))
                return;
            onActionsClose();
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [openActionsId, onActionsClose]);
    useEffect(() => {
        const onEscape = (e) => {
            if (e.key === 'Escape')
                onActionsClose();
        };
        window.addEventListener('keydown', onEscape);
        return () => window.removeEventListener('keydown', onEscape);
    }, [onActionsClose]);
    return (_jsxs("section", { className: "time-users__table-section time-users__table-section--animate", children: [_jsxs("div", { className: "time-users__table-head", children: [_jsx("div", { className: "time-users__table-head-user", children: _jsx("span", { className: "time-users__col-label", children: t('timeTrackingPage.users.table.employee') }) }), _jsxs("div", { className: "time-users__table-cols", children: [_jsx("span", { className: "time-users__col time-users__col--hours", children: t('timeTrackingPage.users.table.hours') }), _jsx("span", { className: "time-users__col time-users__col--util", children: t('timeTrackingPage.users.table.utilization') }), _jsx("span", { className: "time-users__col time-users__col--cap", title: t('timeTrackingPage.users.table.capacityTitle'), children: t('timeTrackingPage.users.table.capacityPerWeek') }), _jsx("span", { className: "time-users__col time-users__col--billable", children: t('timeTrackingPage.users.table.billableHours') }), _jsx("span", { className: "time-users__col time-users__col--actions", "aria-hidden": true })] })] }), _jsx("div", { className: "time-users__table-body", children: users.map((user, idx) => (_jsx(TimeUserRowComponent, { user: user, index: idx, isActionsOpen: openActionsId === user.id, onActionsToggle: onActionsOpen, onActionsClose: onActionsClose, actionsMenuRef: actionsMenuRef, onOpenProjectAccess: onOpenProjectAccess }, user.id))) })] }));
}
