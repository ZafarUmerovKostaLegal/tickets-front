import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { formatDateOnly } from '@shared/lib/formatDate';
import { getPositionMeta, positionCatalogIncludes } from '../model/constants';
export function UserRow({ user: u, savingUserId, openRoleDropdown, setOpenRoleDropdown, roleMenuPos, setRoleMenuPos, roleTriggerRef, roleMenuRef, openTTDropdown, setOpenTTDropdown, ttMenuPos, setTTMenuPos, ttTriggerRef, ttMenuRef, openPosDropdown, setOpenPosDropdown, posMenuPos, setPosMenuPos, posTriggerRef, posMenuRef, onRoleChange, onTTRoleChange, onPositionChange, onToggleBlocked, onToggleArchived, KNOWN_ROLES, ROLE_META, TT_ROLE_OPTIONS, TT_POSITIONS, }) {
    const statusKey = u.is_archived ? 'archived' : u.is_blocked ? 'blocked' : 'active';
    const statusLabel = u.is_archived ? 'Архив' : u.is_blocked ? 'Заблокирован' : 'Активен';
    const isSaving = savingUserId === u.id;
    const currentTT = TT_ROLE_OPTIONS.find((o) => o.value === u.time_tracking_role) ?? TT_ROLE_OPTIONS[0];
    const currPos = u.position?.trim() ? u.position.trim() : null;
    const posMeta = currPos ? getPositionMeta(currPos) : null;
    const posOptions = currPos && !positionCatalogIncludes(TT_POSITIONS, currPos)
        ? [currPos, ...TT_POSITIONS]
        : TT_POSITIONS;
    return (_jsxs("tr", { className: statusKey !== 'active' ? 'ap__row--dim' : '', children: [_jsx("td", { children: _jsxs("div", { className: "ap__user-cell", children: [_jsx("span", { className: "ap__user-avatar", children: (u.display_name || 'U').charAt(0).toUpperCase() }), _jsx("span", { className: "ap__user-name", children: u.display_name || '—' })] }) }), _jsx("td", { className: "ap__td-email", children: u.email }), _jsx("td", { children: _jsxs("div", { className: "ap__role-dd", children: [_jsxs("button", { type: "button", className: `ap__role-trigger${openRoleDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`, disabled: isSaving, "aria-haspopup": "listbox", "aria-expanded": openRoleDropdown === u.id, ref: openRoleDropdown === u.id ? roleTriggerRef : undefined, onClick: (e) => {
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
                            }, children: [_jsx("span", { className: "ap__role-dot", style: { background: (ROLE_META[u.role] ?? ROLE_META['Сотрудник']).color } }), _jsx("span", { className: "ap__role-label", children: u.role || '—' }), _jsx("svg", { className: "ap__role-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), openRoleDropdown === u.id && roleMenuPos && createPortal(_jsx("div", { className: "ap__role-menu", role: "listbox", style: { position: 'fixed', top: roleMenuPos.top, left: roleMenuPos.left, minWidth: Math.max(roleMenuPos.width, 180) }, ref: roleMenuRef, children: KNOWN_ROLES.map((r) => {
                                const meta = ROLE_META[r];
                                const isActive = u.role === r;
                                return (_jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ap__role-option${isActive ? ' ap__role-option--active' : ''}`, onClick: () => { onRoleChange(u, r); setOpenRoleDropdown(null); setRoleMenuPos(null); }, style: isActive ? { background: meta.bg, color: meta.color, borderColor: meta.border } : undefined, children: [_jsx("span", { className: "ap__role-option-dot", style: { background: meta.color } }), r, isActive && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }, r));
                            }) }), document.body)] }) }), _jsx("td", { children: _jsxs("div", { className: "ap__role-dd", children: [_jsxs("button", { type: "button", className: `ap__role-trigger${openTTDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`, disabled: isSaving, "aria-haspopup": "listbox", "aria-expanded": openTTDropdown === u.id, ref: openTTDropdown === u.id ? ttTriggerRef : undefined, onClick: (e) => {
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
                            }, children: [_jsx("span", { className: "ap__role-dot", style: { background: currentTT.color } }), _jsx("span", { className: "ap__role-label", children: currentTT.label }), _jsx("svg", { className: "ap__role-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), openTTDropdown === u.id && ttMenuPos && createPortal(_jsx("div", { className: "ap__role-menu", role: "listbox", style: { position: 'fixed', top: ttMenuPos.top, left: ttMenuPos.left, minWidth: Math.max(ttMenuPos.width, 180) }, ref: ttMenuRef, children: TT_ROLE_OPTIONS.map((opt) => {
                                const isActive = u.time_tracking_role === opt.value;
                                return (_jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ap__role-option${isActive ? ' ap__role-option--active' : ''}`, onClick: () => { onTTRoleChange(u, opt.value); setOpenTTDropdown(null); setTTMenuPos(null); }, style: isActive ? { background: opt.bg, color: opt.color, borderColor: opt.border } : undefined, children: [_jsx("span", { className: "ap__role-option-dot", style: { background: opt.color } }), opt.label, isActive && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }, String(opt.value)));
                            }) }), document.body)] }) }), _jsx("td", { children: _jsxs("div", { className: "ap__role-dd", children: [_jsxs("button", { type: "button", className: `ap__role-trigger${openPosDropdown === u.id ? ' ap__role-trigger--open' : ''}${isSaving ? ' ap__role-trigger--disabled' : ''}`, "aria-haspopup": "listbox", "aria-expanded": openPosDropdown === u.id, ref: openPosDropdown === u.id ? posTriggerRef : undefined, onClick: (e) => {
                                if (openPosDropdown === u.id) {
                                    setOpenPosDropdown(null);
                                    setPosMenuPos(null);
                                }
                                else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setPosMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                                    setOpenPosDropdown(u.id);
                                }
                            }, children: [_jsx("span", { className: "ap__role-dot", style: { background: posMeta ? posMeta.color : '#94a3b8' } }), _jsx("span", { className: "ap__role-label", style: posMeta ? { color: posMeta.color } : { color: '#94a3b8' }, children: currPos ?? 'Должность' }), _jsx("svg", { className: "ap__role-chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), openPosDropdown === u.id && posMenuPos && createPortal(_jsxs("div", { className: "ap__role-menu", role: "listbox", style: { position: 'fixed', top: posMenuPos.top, left: posMenuPos.left, minWidth: Math.max(posMenuPos.width, 200) }, ref: posMenuRef, children: [_jsxs("button", { type: "button", role: "option", "aria-selected": currPos === null, className: `ap__role-option${currPos === null ? ' ap__role-option--active' : ''}`, onClick: () => onPositionChange(u, null), children: [_jsx("span", { className: "ap__role-option-dot", style: { background: '#94a3b8' } }), "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430", currPos === null && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }), posOptions.map((pos) => {
                                    const m = getPositionMeta(pos);
                                    const isActive = currPos === pos;
                                    return (_jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ap__role-option${isActive ? ' ap__role-option--active' : ''}`, onClick: () => onPositionChange(u, pos), style: isActive ? { background: m.bg, color: m.color, borderColor: m.border } : undefined, children: [_jsx("span", { className: "ap__role-option-dot", style: { background: m.color } }), pos, isActive && _jsx("svg", { className: "ap__role-check", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M20 6L9 17l-5-5" }) })] }, pos));
                                })] }), document.body)] }) }), _jsx("td", { children: _jsx("span", { className: `ap__status-badge ap__status-badge--${statusKey}`, children: statusLabel }) }), _jsx("td", { className: "ap__td-date", children: formatDateOnly(u.created_at) }), _jsx("td", { className: "ap__td-date", children: formatDateOnly(u.updated_at) }), _jsx("td", { children: _jsxs("div", { className: "ap__actions", children: [_jsx("button", { type: "button", className: `ap__act-btn ${u.is_blocked ? 'ap__act-btn--success' : 'ap__act-btn--warn'}`, disabled: isSaving, onClick: () => onToggleBlocked(u), children: u.is_blocked ? 'Разблокировать' : 'Заблокировать' }), _jsx("button", { type: "button", className: "ap__act-btn ap__act-btn--ghost", disabled: isSaving, onClick: () => onToggleArchived(u), children: u.is_archived ? 'Восстановить' : 'В архив' })] }) })] }));
}
