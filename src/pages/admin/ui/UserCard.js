import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { formatDateOnly } from '@shared/lib/formatDate';
import { useAppDialog, useAppToast } from '@shared/ui';
import { queueBirthdayGreeting } from '@widgets/birthday-postcard';
import { getPositionMeta, positionCatalogIncludes } from '../model/constants';
export function UserCard({ user: u, savingUserId, openRoleDropdown, setOpenRoleDropdown, roleMenuPos, setRoleMenuPos, roleTriggerRef, roleMenuRef, openTTDropdown, setOpenTTDropdown, ttMenuPos, setTTMenuPos, ttTriggerRef, ttMenuRef, openPosDropdown, setOpenPosDropdown, posMenuPos, setPosMenuPos, posTriggerRef, posMenuRef, onRoleChange, onTTRoleChange, onPositionChange, onToggleBlocked, onToggleArchived, KNOWN_ROLES, ROLE_META, TT_ROLE_OPTIONS, TT_POSITIONS, }) {
    const { showConfirm } = useAppDialog();
    const { pushToast } = useAppToast();
    const statusKey = u.is_archived ? 'archived' : u.is_blocked ? 'blocked' : 'active';
    const statusLabel = u.is_archived ? 'Архив' : u.is_blocked ? 'Заблокирован' : 'Активен';
    const isSaving = savingUserId === u.id;
    const currentTT = TT_ROLE_OPTIONS.find((o) => o.value === u.time_tracking_role) ?? TT_ROLE_OPTIONS[0];
    const currPos = u.position?.trim() ? u.position.trim() : null;
    const posMeta = currPos ? getPositionMeta(currPos) : null;
    const posOptions = currPos && !positionCatalogIncludes(TT_POSITIONS, currPos)
        ? [currPos, ...TT_POSITIONS]
        : TT_POSITIONS;
    const handleSendBirthday = async () => {
        const ok = await showConfirm({
            title: 'Поздравить с днём рождения?',
            message: `Фирменная открытка откроется у «${u.display_name?.trim() || u.email}» при входе в систему (поверх интерфейса, с фанфарами).`,
            confirmLabel: 'Отправить открытку',
        });
        if (!ok)
            return;
        queueBirthdayGreeting({
            recipientEmail: u.email,
            recipientUserId: u.id,
            recipientName: u.display_name?.trim() || u.email,
            senderName: 'команда Kosta Legal',
        });
        pushToast({
            variant: 'success',
            message: `Поздравление для ${u.email} поставлено в очередь.`,
        });
    };
    const handleRoleClick = (e) => {
        if (isSaving)
            return;
        if (openRoleDropdown === u.id) {
            setOpenRoleDropdown(null);
            setRoleMenuPos(null);
        }
        else {
            const rect = e.currentTarget.getBoundingClientRect();
            setRoleMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpenRoleDropdown(u.id);
        }
    };
    const handleTTClick = (e) => {
        if (isSaving)
            return;
        if (openTTDropdown === u.id) {
            setOpenTTDropdown(null);
            setTTMenuPos(null);
        }
        else {
            const rect = e.currentTarget.getBoundingClientRect();
            setTTMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpenTTDropdown(u.id);
        }
    };
    const handlePosClick = (e) => {
        if (openPosDropdown === u.id) {
            setOpenPosDropdown(null);
            setPosMenuPos(null);
        }
        else {
            const rect = e.currentTarget.getBoundingClientRect();
            setPosMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpenPosDropdown(u.id);
        }
    };
    return (_jsxs("article", { className: `ap__user-card ap__user-card--${statusKey} ${statusKey !== 'active' ? 'ap__user-card--dim' : ''}`, children: [_jsxs("div", { className: "ap__user-card-header", children: [_jsx("span", { className: "ap__user-avatar", style: { width: 'var(--user-card-avatar-size)', height: 'var(--user-card-avatar-size)', fontSize: 'var(--user-card-avatar-font-size)' }, children: (u.display_name || 'U').charAt(0).toUpperCase() }), _jsxs("div", { className: "ap__user-card-header-text", children: [_jsxs("div", { className: "ap__user-card-name-row", children: [_jsx("span", { className: "ap__user-name", style: { fontWeight: 'var(--user-card-name-font-weight)', fontSize: 'var(--user-card-name-font-size)' }, children: u.display_name || '—' }), _jsx("span", { className: `ap__status-badge ap__status-badge--${statusKey}`, children: statusLabel })] }), _jsx("a", { href: `mailto:${u.email}`, className: "ap__user-card-email", style: { fontSize: 'var(--user-card-email-font-size)', color: 'var(--user-card-email-color)' }, children: u.email })] })] }), _jsxs("div", { className: "ap__user-card-body", style: { gap: 'var(--user-card-body-gap)' }, children: [_jsxs("div", { className: "ap__user-card-section", style: { gap: 'var(--user-card-section-gap)' }, children: [_jsxs("div", { className: "ap__user-card-row", style: { fontSize: 'var(--user-card-row-font-size)' }, children: [_jsx("span", { className: "ap__user-card-lbl", style: { fontSize: 'var(--user-card-lbl-font-size)', fontWeight: 'var(--user-card-lbl-font-weight)', color: 'var(--user-card-lbl-color)' }, children: "\u0420\u043E\u043B\u044C" }), _jsxs("div", { className: "ap__role-dd", children: [_jsxs("button", { type: "button", className: `ap__role-trigger ap__role-trigger--card${openRoleDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`, disabled: isSaving, "aria-haspopup": "listbox", "aria-expanded": openRoleDropdown === u.id, ref: openRoleDropdown === u.id ? roleTriggerRef : undefined, onClick: handleRoleClick, children: [_jsx("span", { className: "ap__role-dot", style: { background: (ROLE_META[u.role] ?? ROLE_META['Сотрудник']).color } }), _jsx("span", { className: "ap__role-label", children: u.role || '—' }), _jsx("svg", { className: "ap__role-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), openRoleDropdown === u.id && roleMenuPos && createPortal(_jsx("div", { className: "ap__role-menu", role: "listbox", style: { position: 'fixed', top: roleMenuPos.top, left: roleMenuPos.left, minWidth: Math.max(roleMenuPos.width, 180) }, ref: roleMenuRef, children: KNOWN_ROLES.map((r) => {
                                                    const meta = ROLE_META[r];
                                                    const isActive = u.role === r;
                                                    return (_jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ap__role-option${isActive ? ' ap__role-option--active' : ''}`, onClick: () => { onRoleChange(u, r); setOpenRoleDropdown(null); setRoleMenuPos(null); }, style: isActive ? { background: meta.bg, color: meta.color, borderColor: meta.border } : undefined, children: [_jsx("span", { className: "ap__role-option-dot", style: { background: meta.color } }), r, isActive && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }, r));
                                                }) }), document.body)] })] }), _jsxs("div", { className: "ap__user-card-row", style: { fontSize: 'var(--user-card-row-font-size)' }, children: [_jsx("span", { className: "ap__user-card-lbl", style: { fontSize: 'var(--user-card-lbl-font-size)', fontWeight: 'var(--user-card-lbl-font-weight)', color: 'var(--user-card-lbl-color)' }, children: "\u0423\u0447\u0451\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), _jsxs("div", { className: "ap__role-dd", children: [_jsxs("button", { type: "button", className: `ap__role-trigger ap__role-trigger--card${openTTDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`, disabled: isSaving, "aria-haspopup": "listbox", "aria-expanded": openTTDropdown === u.id, ref: openTTDropdown === u.id ? ttTriggerRef : undefined, onClick: handleTTClick, children: [_jsx("span", { className: "ap__role-dot", style: { background: currentTT.color } }), _jsx("span", { className: "ap__role-label", children: currentTT.label }), _jsx("svg", { className: "ap__role-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), openTTDropdown === u.id && ttMenuPos && createPortal(_jsx("div", { className: "ap__role-menu", role: "listbox", style: { position: 'fixed', top: ttMenuPos.top, left: ttMenuPos.left, minWidth: Math.max(ttMenuPos.width, 180) }, ref: ttMenuRef, children: TT_ROLE_OPTIONS.map((opt) => {
                                                    const isActive = u.time_tracking_role === opt.value;
                                                    return (_jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ap__role-option${isActive ? ' ap__role-option--active' : ''}`, onClick: () => { onTTRoleChange(u, opt.value); setOpenTTDropdown(null); setTTMenuPos(null); }, style: isActive ? { background: opt.bg, color: opt.color, borderColor: opt.border } : undefined, children: [_jsx("span", { className: "ap__role-option-dot", style: { background: opt.color } }), opt.label, isActive && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }, String(opt.value)));
                                                }) }), document.body)] })] }), _jsxs("div", { className: "ap__user-card-row", style: { fontSize: 'var(--user-card-row-font-size)' }, children: [_jsx("span", { className: "ap__user-card-lbl", style: { fontSize: 'var(--user-card-lbl-font-size)', fontWeight: 'var(--user-card-lbl-font-weight)', color: 'var(--user-card-lbl-color)' }, children: "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C" }), _jsxs("div", { className: "ap__role-dd", children: [_jsxs("button", { type: "button", className: `ap__role-trigger ap__role-trigger--card${openPosDropdown === u.id ? ' ap__role-trigger--open' : ''}`, "aria-haspopup": "listbox", "aria-expanded": openPosDropdown === u.id, ref: openPosDropdown === u.id ? posTriggerRef : undefined, onClick: handlePosClick, children: [_jsx("span", { className: "ap__role-dot", style: { background: posMeta ? posMeta.color : '#94a3b8' } }), _jsx("span", { className: "ap__role-label", title: currPos ?? 'Должность', style: posMeta ? { color: posMeta.color } : { color: '#94a3b8' }, children: currPos ?? 'Должность' }), _jsx("svg", { className: "ap__role-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), openPosDropdown === u.id && posMenuPos && createPortal(_jsxs("div", { className: "ap__role-menu", role: "listbox", style: { position: 'fixed', top: posMenuPos.top, left: posMenuPos.left, minWidth: Math.max(posMenuPos.width, 200) }, ref: posMenuRef, children: [_jsxs("button", { type: "button", role: "option", "aria-selected": currPos === null, className: `ap__role-option${currPos === null ? ' ap__role-option--active' : ''}`, onClick: () => onPositionChange(u, null), children: [_jsx("span", { className: "ap__role-option-dot", style: { background: '#94a3b8' } }), "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430", currPos === null && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }), posOptions.map((pos) => {
                                                        const m = getPositionMeta(pos);
                                                        const isActive = currPos === pos;
                                                        return (_jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ap__role-option${isActive ? ' ap__role-option--active' : ''}`, onClick: () => onPositionChange(u, pos), style: isActive ? { background: m.bg, color: m.color, borderColor: m.border } : undefined, children: [_jsx("span", { className: "ap__role-option-dot", style: { background: m.color } }), pos, isActive && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }, pos));
                                                    })] }), document.body)] })] })] }), _jsxs("div", { className: "ap__user-card-meta", style: { fontSize: 'var(--user-card-meta-font-size)', color: 'var(--user-card-meta-color)' }, children: [_jsx("span", { title: "\u0421\u043E\u0437\u0434\u0430\u043D", children: formatDateOnly(u.created_at) }), _jsx("span", { className: "ap__user-card-meta-sep", children: "\u00B7" }), _jsx("span", { title: "\u041E\u0431\u043D\u043E\u0432\u043B\u0451\u043D", children: u.updated_at ? formatDateOnly(u.updated_at) : '—' })] })] }), _jsxs("div", { className: "ap__user-card-actions", children: [_jsx("button", { type: "button", className: "ap__act-btn ap__act-btn--birthday", disabled: isSaving || u.is_archived, title: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0444\u0438\u0440\u043C\u0435\u043D\u043D\u0443\u044E \u043E\u0442\u043A\u0440\u044B\u0442\u043A\u0443 \u0441 \u0434\u043D\u0451\u043C \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F", onClick: () => void handleSendBirthday(), children: "\u0421 \u0414\u0420" }), _jsx("button", { type: "button", className: `ap__act-btn ${u.is_blocked ? 'ap__act-btn--success' : 'ap__act-btn--warn'}`, disabled: isSaving, onClick: () => onToggleBlocked(u), children: u.is_blocked ? 'Разблокировать' : 'Заблокировать' }), _jsx("button", { type: "button", className: "ap__act-btn ap__act-btn--ghost", disabled: isSaving, onClick: () => onToggleArchived(u), children: u.is_archived ? 'Восстановить' : 'В архив' })] })] }));
}
