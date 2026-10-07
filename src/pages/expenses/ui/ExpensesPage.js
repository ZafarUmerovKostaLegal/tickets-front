import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { routes, getExpensesOpenUrl } from '@shared/config';
import { useCurrentUser, useMediaQuery } from '@shared/hooks';
import { AppBackButton, AppHomeLogo, AppPageSettings, DatePicker, Pagination } from '@shared/ui';
import { ExpenseConfirmDialog } from './ExpenseConfirmDialog';
import { EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG, EXPENSE_ATTACHMENT_MAX_COUNT } from '@entities/expenses/model/types';
import { TYPE_META, REIMBURSABLE_META, COMPANY_EXPENSE_TYPE_CODES, PARTNER_EXPENSE_CATEGORIES, getPartnerExpenseSubtypeLabel, COMPANY_PRIVATE_EXPENSE_TYPE, canManageCompanyExpense, } from '@entities/expenses/model/constants';
import { approveExpense, payExpense, deleteExpense, fetchExpenses, fetchExpenseById, uploadAttachment, rejectExpense, reviseExpense, } from '@entities/expenses/model/expensesApi';
import { saveExpenseFromForm } from '@entities/expenses/model/saveExpenseFromForm';
import { buildExpensesListParams, EXPENSES_LIST_PAGE_SIZE, } from '@entities/expenses/model/expensesListParams';
import { defaultExpensesSavedFilters, clearExpensesSavedFilters, } from '@entities/expenses/model/expensesFilterStorage';
import { availableExpensesFilterSlots, loadExpensesFilterOrder, mergeExpensesFilterOrder, reorderExpensesFilterOrder, saveExpensesFilterOrder, } from '@entities/expenses/model/expensesFilterOrder';
import { defaultExpensesCustomRange, EXPENSES_PERIOD_LABELS, EXPENSES_PERIOD_PRESET_IDS, expensesPeriodFilterLabel, } from '@entities/expenses/model/expensesPeriodPresets';
import { asExpenseNumber, normalizeExpenseRequest } from '@entities/expenses/model/coerceExpense';
import { isEmployeePersonalFundsPayout } from '@entities/expenses/model/expensePaymentDetails';
import { listPartners, loadPublicUsersByIds } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { isHiddenSystemUser } from '@shared/lib';
import { formatExpenseApprovedByLabel, formatExpenseAuthorLabel, mergeExpenseAuthorFromCache, needsAuthorEnrichment, formatPartnerUserLabel, } from '@entities/expenses/model/expenseAuthor';
import { canViewExpensesRequestsAndReport } from '@entities/expenses/model/expenseModeration';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { useExpenseAttentionBadge } from '@entities/expenses/model/useExpensePaymentConfirmationBadge';
import { fetchExpenseStatusCounts, formatExpenseStatusCount, } from '@entities/expenses/model/fetchExpenseStatusCounts';
import { isModerationBlockedForOwnExpense, isReceiptUploadAllowedForExpenseStatus, showOwnPendingModerationBlockedHint, resolveExpensePanelMode, showPayExpenseAction, showPendingApprovalModeration, showDeleteExpenseAction, } from '@entities/expenses/model/expenseStatusPolicy';
import { expensePayActionLabel, expenseStatusBadgeClass, expenseStatusLabel, expenseUiStatusFilterLabel, EXPENSE_STATUS_FILTER_OPTIONS, AWAITING_REIMBURSEMENT_STATUS_FILTER, isExpensesUiStatusFilter } from '@entities/expenses/model/expenseStatusLabels';
import { isExpensePaymentConfirmer } from '@entities/expenses/model/expensePaymentConfirmer';
import { ExpensesPageBoundary } from './ExpensesPageBoundary';
import '@pages/time-tracking/ui/TimeTrackingForms.css';
import './ExpensesPage.css';
const ExpensesFormPanel = lazy(() => import('./ExpensesFormPanel').then((m) => ({ default: m.ExpensesFormPanel })));
const ExpensesReportModal = lazy(() => import('@features/expense-report').then((m) => ({ default: m.ExpensesReportModal })));
const FILTER_DRAG_MIME = 'application/x-expenses-filter-slot';
function authorFilterLabel(u) {
    return u.display_name?.trim() || u.email?.trim() || `Пользователь #${u.id}`;
}
const SORT_LABELS = {
    createdAt: 'По дате создания',
    expenseDate: 'По дате расхода',
};
function fmtDate(iso) {
    if (!iso)
        return '—';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function expenseDateKey(raw) {
    const s = String(raw ?? '').slice(0, 10);
    return ISO_DATE_RE.test(s) ? s : '';
}
function fmtExpenseDateCell(raw) {
    const k = expenseDateKey(raw);
    return k ? fmtDate(k) : '—';
}
function fmtUzs(raw) {
    return asExpenseNumber(raw).toLocaleString('ru-RU');
}
function StatusBadge({ req }) {
    return _jsx("span", { className: expenseStatusBadgeClass(req), children: expenseStatusLabel(req) });
}
function IconDotsVertical() {
    return (_jsxs("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "5", r: "1.85" }), _jsx("circle", { cx: "12", cy: "12", r: "1.85" }), _jsx("circle", { cx: "12", cy: "19", r: "1.85" })] }));
}
function ExpenseTableRow({ req, onOpen, canModerate, isPaymentConfirmer, currentUserId, currentUserRole, moderationBusyId, onApprove, onRejectClick, onReviseClick, onPay, onDeleteClick, isActionMenuOpen, onToggleActionMenu, onCloseActionMenu, partnerScope = false, isCurrent = false, }) {
    const typeLabel = TYPE_META[req.expenseType]?.label ?? req.expenseType;
    const subtypeLabel = req.expenseType === 'partner_expense'
        ? getPartnerExpenseSubtypeLabel(req.expenseSubtype)
        : '';
    const partnerLabel = req.expenseType === 'partner_expense' ? formatPartnerUserLabel(req) : '';
    const typeCellTitle = [typeLabel, subtypeLabel, partnerLabel].filter(Boolean).join(' · ');
    const typeCellPrimary = partnerScope && subtypeLabel ? subtypeLabel : typeLabel;
    const typeCellSecondary = partnerScope
        ? (partnerLabel || null)
        : (partnerLabel || (subtypeLabel || null));
    const reimbLabel = req.isReimbursable
        ? REIMBURSABLE_META['reimbursable'].label
        : REIMBURSABLE_META['non_reimbursable'].label;
    const reimbKey = req.isReimbursable ? 'reimbursable' : 'non_reimbursable';
    const uzsAmt = asExpenseNumber(req.amountUzs);
    const equivUsd = asExpenseNumber(req.equivalentAmount);
    const rate = asExpenseNumber(req.exchangeRate);
    const blockedOwn = isModerationBlockedForOwnExpense(canModerate, currentUserId, req);
    const showMod = showPendingApprovalModeration(req, canModerate, blockedOwn);
    const showOwnModHint = showOwnPendingModerationBlockedHint(req, canModerate, blockedOwn);
    const showPay = showPayExpenseAction(req, blockedOwn, { isPaymentConfirmer, canModerate });
    const showDelete = showDeleteExpenseAction(req, currentUserId, currentUserRole);
    const busy = moderationBusyId === req.id;
    const canEditFromList = resolveExpensePanelMode(req.status) === 'edit';
    const actionsModeration = showMod;
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [menuFixedStyle, setMenuFixedStyle] = useState(null);
    useLayoutEffect(() => {
        if (!isActionMenuOpen || !triggerRef.current) {
            setMenuFixedStyle(null);
            return;
        }
        const r = triggerRef.current.getBoundingClientRect();
        const minWidth = Math.max(200, r.width);
        let left = r.right - minWidth;
        const maxLeft = typeof window !== 'undefined' ? window.innerWidth - minWidth - 8 : left;
        left = Math.max(8, Math.min(left, maxLeft));
        const top = r.bottom + 6;
        setMenuFixedStyle({ top, left, minWidth });
    }, [isActionMenuOpen]);
    useEffect(() => {
        if (!isActionMenuOpen)
            return;
        const onDoc = (e) => {
            const t = e.target;
            if (triggerRef.current?.contains(t) || menuRef.current?.contains(t))
                return;
            onCloseActionMenu();
        };
        const onKey = (e) => {
            if (e.key === 'Escape')
                onCloseActionMenu();
        };
        const onReposition = () => {
            if (!triggerRef.current)
                return;
            const r = triggerRef.current.getBoundingClientRect();
            const minWidth = Math.max(200, r.width);
            let left = r.right - minWidth;
            const maxLeft = window.innerWidth - minWidth - 8;
            left = Math.max(8, Math.min(left, maxLeft));
            setMenuFixedStyle({ top: r.bottom + 6, left, minWidth });
        };
        document.addEventListener('mousedown', onDoc);
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onReposition, true);
        window.addEventListener('resize', onReposition);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onReposition, true);
            window.removeEventListener('resize', onReposition);
        };
    }, [isActionMenuOpen, onCloseActionMenu]);
    const usdTitle = equivUsd > 0 && rate > 0
        ? `Курс: ${rate.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 4 })} UZS за 1 USD`
        : undefined;
    return (_jsxs("div", { className: `exp-table__row exp-table__row--${req.status}${isCurrent ? ' exp-table__row--current' : ''}`, role: "row", "aria-current": isCurrent ? 'true' : undefined, onClick: () => onOpen(req), children: [_jsx("div", { className: "exp-table__td exp-table__td--num", role: "cell", children: _jsx("span", { className: "exp-table__num", children: req.id }) }), _jsx("div", { className: "exp-table__td exp-table__td--desc", role: "cell", children: _jsx("span", { className: "exp-table__desc", children: String(req.description ?? '') }) }), _jsx("div", { className: "exp-table__td exp-table__td--author", role: "cell", children: _jsx("span", { className: "exp-table__author", children: formatExpenseAuthorLabel(req) }) }), _jsx("div", { className: "exp-table__td exp-table__td--approvedby", role: "cell", children: _jsx("span", { className: "exp-table__author", children: formatExpenseApprovedByLabel(req) }) }), _jsx("div", { className: "exp-table__td exp-table__td--expdate", role: "cell", children: fmtExpenseDateCell(req.expenseDate) }), _jsxs("div", { className: "exp-table__td exp-table__td--type", role: "cell", title: typeCellTitle, children: [typeCellPrimary, typeCellSecondary ? (_jsx("span", { className: "exp-table__partner-sub", children: typeCellSecondary })) : null] }), _jsx("div", { className: "exp-table__td exp-table__td--reimb", role: "cell", children: _jsx("span", { className: `exp-reimb exp-reimb--${reimbKey}`, children: reimbLabel }) }), _jsx("div", { className: "exp-table__td exp-table__td--status", role: "cell", children: _jsxs("div", { className: "exp-table__status-tags", children: [_jsx(StatusBadge, { req: req }), (req.status === 'rejected' || req.status === 'revision_required') && req.rejectionReason ? (_jsxs("span", { className: `exp-table__status-reason${req.status === 'revision_required' ? ' exp-table__status-reason--revision' : ''}`, title: req.rejectionReason, children: [_jsx("span", { className: "exp-table__status-reason-label", children: req.status === 'revision_required' ? 'Что исправить:' : 'Причина:' }), ' ', _jsx("span", { className: "exp-table__status-reason-text", children: req.rejectionReason })] })) : null, req.expenseType === 'partner_expense' && !partnerScope && (_jsx("span", { className: "exp-card__partner-pill exp-card__partner-pill--table", title: "\u0420\u0430\u0441\u0445\u043E\u0434 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 \u00B7 \u0431\u0435\u0437 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u043C", children: "\u0420\u0430\u0441\u0445\u043E\u0434 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430" }))] }) }), _jsx("div", { className: "exp-table__td exp-table__td--uzs", role: "cell", children: _jsx("span", { className: "exp-table__money-uzs", children: fmtUzs(uzsAmt) }) }), _jsx("div", { className: "exp-table__td exp-table__td--usd", role: "cell", title: usdTitle, children: equivUsd > 0 ? (_jsxs("span", { className: "exp-table__usd-one-line", children: [_jsx("span", { className: "exp-table__usd-num", children: equivUsd.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }), _jsx("span", { className: "exp-table__usd-suffix", children: "USD" })] })) : (_jsx("span", { className: "exp-table__money-empty", children: "\u2014" })) }), _jsxs("div", { className: "exp-table__td exp-table__td--action", role: "cell", onClick: e => e.stopPropagation(), children: [_jsx("div", { className: "exp-table__action-trigger-wrap", children: _jsx("button", { ref: triggerRef, type: "button", className: `exp-table__actions-trigger${isActionMenuOpen ? ' exp-table__actions-trigger--open' : ''}`, "aria-haspopup": "menu", "aria-expanded": isActionMenuOpen, "aria-label": "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u043E \u0437\u0430\u044F\u0432\u043A\u0435", disabled: busy, onClick: e => {
                                e.stopPropagation();
                                onToggleActionMenu();
                            }, children: _jsx(IconDotsVertical, {}) }) }), isActionMenuOpen && menuFixedStyle && typeof document !== 'undefined' && createPortal(_jsxs("div", { ref: menuRef, className: "exp-table__actions-menu exp-table__actions-menu--portal", style: {
                            position: 'fixed',
                            top: menuFixedStyle.top,
                            left: menuFixedStyle.left,
                            minWidth: menuFixedStyle.minWidth,
                            zIndex: 12040,
                        }, role: "menu", onClick: e => e.stopPropagation(), children: [showOwnModHint && (_jsx("p", { className: "exp-table__menu-hint", role: "note", children: "\u0421\u0432\u043E\u044E \u0437\u0430\u044F\u0432\u043A\u0443 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u2014 \u043E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u043A \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440\u0443." })), actionsModeration && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "exp-table__menu-item exp-table__menu-item--accent", role: "menuitem", disabled: busy, onClick: () => {
                                            onCloseActionMenu();
                                            onApprove(req);
                                        }, children: "\u041E\u0434\u043E\u0431\u0440\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "exp-table__menu-item exp-table__menu-item--danger", role: "menuitem", disabled: busy, onClick: () => {
                                            onCloseActionMenu();
                                            onRejectClick(req);
                                        }, children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "exp-table__menu-item", role: "menuitem", disabled: busy, onClick: () => {
                                            onCloseActionMenu();
                                            onReviseClick(req);
                                        }, children: "\u041D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443" }), _jsx("div", { className: "exp-table__menu-sep", role: "separator" })] })), showPay && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "exp-table__menu-item", role: "menuitem", disabled: busy, onClick: () => {
                                            onCloseActionMenu();
                                            onPay(req);
                                        }, children: expensePayActionLabel(req) }), _jsx("div", { className: "exp-table__menu-sep", role: "separator" })] })), _jsx("button", { type: "button", className: "exp-table__menu-item", role: "menuitem", onClick: () => {
                                    onCloseActionMenu();
                                    onOpen(req, { mode: 'view' });
                                }, children: "\u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F" }), canEditFromList && (_jsx("button", { type: "button", className: "exp-table__menu-item", role: "menuitem", onClick: () => {
                                    onCloseActionMenu();
                                    onOpen(req, { mode: 'edit' });
                                }, children: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C" })), showDelete && (_jsx("button", { type: "button", className: "exp-table__menu-item exp-table__menu-item--danger", role: "menuitem", disabled: busy, onClick: () => {
                                    onCloseActionMenu();
                                    onDeleteClick(req);
                                }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })), _jsx("button", { type: "button", className: "exp-table__menu-item exp-table__menu-item--primary", role: "menuitem", disabled: busy, onClick: () => {
                                    onCloseActionMenu();
                                    onOpen(req);
                                }, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] }), document.body)] })] }));
}
function EmptyState({ hasFilters, onCreate, moderationQueue, }) {
    if (moderationQueue) {
        return (_jsxs("div", { className: "exp-empty", children: [_jsx("div", { className: "exp-empty__icon", children: _jsxs("svg", { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "8", y: "10", width: "32", height: "36", rx: "3" }), _jsx("line", { x1: "16", y1: "20", x2: "32", y2: "20" }), _jsx("line", { x1: "16", y1: "27", x2: "28", y2: "27" }), _jsx("line", { x1: "16", y1: "34", x2: "24", y2: "34" })] }) }), hasFilters ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "exp-empty__title", children: "\u0417\u0430\u044F\u0432\u043E\u043A \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }), _jsx("p", { className: "exp-empty__desc", children: "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A \u0438\u043B\u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u044B" })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "exp-empty__title", children: "\u041D\u0435\u0442 \u0437\u0430\u044F\u0432\u043E\u043A \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0438" }), _jsx("p", { className: "exp-empty__desc", children: "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430\u043C\u0438 \u0437\u0430\u044F\u0432\u043A\u0438 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0432 \u044D\u0442\u043E\u043C \u0441\u043F\u0438\u0441\u043A\u0435. \u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 \u0441\u0440\u0430\u0437\u0443 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441\u0435 \u00AB\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E\u00BB \u0438 \u0441\u044E\u0434\u0430 \u043D\u0435 \u043F\u043E\u043F\u0430\u0434\u0430\u044E\u0442." })] }))] }));
    }
    return (_jsxs("div", { className: "exp-empty", children: [_jsx("div", { className: "exp-empty__icon", children: _jsxs("svg", { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "8", y: "10", width: "32", height: "36", rx: "3" }), _jsx("line", { x1: "16", y1: "20", x2: "32", y2: "20" }), _jsx("line", { x1: "16", y1: "27", x2: "28", y2: "27" }), _jsx("line", { x1: "16", y1: "34", x2: "24", y2: "34" }), _jsx("circle", { cx: "38", cy: "10", r: "8", fill: "var(--app-accent)", stroke: "none" }), _jsx("line", { x1: "38", y1: "7", x2: "38", y2: "13", stroke: "white", strokeWidth: "2" }), _jsx("line", { x1: "35", y1: "10", x2: "41", y2: "10", stroke: "white", strokeWidth: "2" })] }) }), hasFilters ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "exp-empty__title", children: "\u0417\u0430\u044F\u0432\u043E\u043A \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }), _jsx("p", { className: "exp-empty__desc", children: "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u044B \u0438\u043B\u0438 \u043F\u043E\u0438\u0441\u043A\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441" })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "exp-empty__title", children: "\u0417\u0430\u044F\u0432\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442" }), _jsx("p", { className: "exp-empty__desc", children: "\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u0443\u044E \u0437\u0430\u044F\u0432\u043A\u0443 \u043D\u0430 \u0440\u0430\u0441\u0445\u043E\u0434" }), _jsxs("button", { type: "button", className: "exp-empty__btn", onClick: onCreate, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }), "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443"] })] }))] }));
}
function FilterDrop({ slotId, label, active, isOpen, onToggle, children, badgeCount = 0, wide = false, dragging = false, dropTarget = false, onDragStartSlot, onDragOverSlot, onDropSlot, onDragEndSlot, }) {
    return (_jsxs("div", { className: `exp-filter${active ? ' exp-filter--active' : ''}${wide ? ' exp-filter--wide' : ''}${dragging ? ' exp-filter--dragging' : ''}${dropTarget ? ' exp-filter--drop-target' : ''}`, onMouseDown: (event) => event.stopPropagation(), draggable: true, onDragStart: (e) => onDragStartSlot?.(e, slotId), onDragOver: (e) => onDragOverSlot?.(e, slotId), onDrop: (e) => onDropSlot?.(e, slotId), onDragEnd: onDragEndSlot, title: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u043E\u0440\u044F\u0434\u043E\u043A", children: [_jsxs("button", { type: "button", className: "exp-filter__btn", onClick: onToggle, children: [_jsx("span", { className: "exp-filter__grip", "aria-hidden": true, children: _jsxs("svg", { viewBox: "0 0 12 16", width: "10", height: "14", fill: "currentColor", children: [_jsx("circle", { cx: "3", cy: "3", r: "1.35" }), _jsx("circle", { cx: "9", cy: "3", r: "1.35" }), _jsx("circle", { cx: "3", cy: "8", r: "1.35" }), _jsx("circle", { cx: "9", cy: "8", r: "1.35" }), _jsx("circle", { cx: "3", cy: "13", r: "1.35" }), _jsx("circle", { cx: "9", cy: "13", r: "1.35" })] }) }), _jsx("span", { className: "exp-filter__btn-text", children: label }), badgeCount > 0 ? (_jsx("span", { className: "app-count-badge exp-filter__btn-badge", "aria-hidden": true, children: badgeCount > 99 ? '99+' : String(badgeCount) })) : null, _jsx("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: _jsx("polyline", { points: isOpen ? '4 10 8 6 12 10' : '4 6 8 10 12 6' }) })] }), isOpen && _jsx("div", { className: "exp-filter__drop", draggable: false, onDragStart: (e) => e.stopPropagation(), children: children })] }));
}
function ServiceUnavailable({ message, onRetry }) {
    const isServiceDown = /unavailable|503|недоступ/i.test(message);
    return (_jsxs("div", { className: "exp-service-err", children: [_jsx("div", { className: "exp-service-err__icon", children: _jsxs("svg", { viewBox: "0 0 64 64", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "32", cy: "32", r: "28" }), _jsx("path", { d: "M20 26c0-6.627 5.373-12 12-12s12 5.373 12 12c0 4-2 7-5 9l-1 7H26l-1-7c-3-2-5-5-5-9z" }), _jsx("line", { x1: "32", y1: "50", x2: "32", y2: "52" })] }) }), _jsx("h2", { className: "exp-service-err__title", children: isServiceDown ? 'Сервис временно недоступен' : 'Не удалось загрузить данные' }), _jsx("p", { className: "exp-service-err__desc", children: isServiceDown
                    ? 'Сервис расходов сейчас не отвечает. Попробуйте обновить страницу или повторите попытку через несколько минут.'
                    : message }), _jsxs("button", { type: "button", className: "exp-service-err__btn", onClick: onRetry, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "23 4 23 10 17 10" }), _jsx("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" })] }), "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u043F\u043E\u043F\u044B\u0442\u043A\u0443"] })] }));
}
function SkeletonCell({ w, h = 14, style }) {
    return _jsx("span", { className: "exp-skel", style: { width: w, height: h, ...style } });
}
function SkeletonTableBody({ rowCount = 10 }) {
    return (_jsx("div", { className: "exp-table", "aria-busy": true, children: _jsx("div", { className: "exp-table__body", children: Array.from({ length: rowCount }).map((_, i) => (_jsxs("div", { className: "exp-table__row exp-table__row--skel", "aria-hidden": true, children: [_jsx("div", { className: "exp-table__td exp-table__td--num", children: _jsx(SkeletonCell, { w: 52, h: 13 }) }), _jsxs("div", { className: "exp-table__td exp-table__td--desc", children: [_jsx(SkeletonCell, { w: "92%", h: 12 }), _jsx(SkeletonCell, { w: "70%", h: 12 })] }), _jsx("div", { className: "exp-table__td exp-table__td--author", children: _jsx(SkeletonCell, { w: "88%", h: 12 }) }), _jsx("div", { className: "exp-table__td exp-table__td--approvedby", children: _jsx(SkeletonCell, { w: "88%", h: 12 }) }), _jsx("div", { className: "exp-table__td exp-table__td--expdate", children: _jsx(SkeletonCell, { w: 54, h: 12 }) }), _jsx("div", { className: "exp-table__td exp-table__td--type", children: _jsx(SkeletonCell, { w: "90%", h: 12 }) }), _jsx("div", { className: "exp-table__td exp-table__td--reimb", children: _jsx(SkeletonCell, { w: 72, h: 20, style: { borderRadius: 20 } }) }), _jsx("div", { className: "exp-table__td exp-table__td--status", children: _jsx(SkeletonCell, { w: 76, h: 22, style: { borderRadius: 20 } }) }), _jsx("div", { className: "exp-table__td exp-table__td--uzs", children: _jsx(SkeletonCell, { w: 72, h: 12, style: { marginLeft: 'auto' } }) }), _jsx("div", { className: "exp-table__td exp-table__td--usd", children: _jsx(SkeletonCell, { w: 80, h: 12, style: { marginLeft: 'auto' } }) }), _jsx("div", { className: "exp-table__td exp-table__td--action", children: _jsx(SkeletonCell, { w: 32, h: 32, style: { borderRadius: 8, marginLeft: 'auto' } }) })] }, i))) }) }));
}
function ExpensesPageInner({ variant = 'default' }) {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const navigate = useNavigate();
    const { expenseId: pathExpenseId } = useParams();
    const [searchParams] = useSearchParams();
    const { user, loading: currentUserLoading } = useCurrentUser();
    const canModerate = canViewExpensesRequestsAndReport(user?.role);
    const canSeeCash = isPartnerOrgRole(user?.role, user?.position);
    const isPaymentConfirmer = isExpensePaymentConfirmer(user?.email, { displayName: user?.display_name });
    const { moderationCount, payCount } = useExpenseAttentionBadge(!currentUserLoading && (canModerate || isPaymentConfirmer));
    const [isLoading, setIsLoading] = useState(true);
    const [listFetchPending, setListFetchPending] = useState(false);
    const isFirstListFetchRef = useRef(true);
    const [loadError, setLoadError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [requests, setRequests] = useState([]);
    const [authorCache, setAuthorCache] = useState({});
    const authorFetchStartedRef = useRef(new Set());
    const [loadKey, setLoadKey] = useState(0);
    const [expenseTableMenuForId, setExpenseTableMenuForId] = useState(null);
    const isModerationQueue = variant === 'moderationQueue';
    const isPartnerScope = variant === 'partner';
    const isClientScope = variant === 'client';
    const scopeMode = isPartnerScope ? 'partner' : (isModerationQueue ? undefined : 'company');
    const filterStorageUserId = user?.id ?? null;
    const filterOwnerKey = !currentUserLoading && filterStorageUserId != null
        ? `${filterStorageUserId}:${variant}`
        : null;
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterSubtype, setFilterSubtype] = useState('');
    const [filterPartnerUserId, setFilterPartnerUserId] = useState('');
    const [partnerFilterOptions, setPartnerFilterOptions] = useState([]);
    const [filterAuthorUserId, setFilterAuthorUserId] = useState('');
    const [authorFilterOptions, setAuthorFilterOptions] = useState([]);
    const [authorFilterQuery, setAuthorFilterQuery] = useState('');
    const [filterReimb, setFilterReimb] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterSort, setFilterSort] = useState('createdAt');
    const [openFilter, setOpenFilter] = useState(null);
    const [filterOrder, setFilterOrder] = useState(() => availableExpensesFilterSlots({ variant, canModerate }));
    const [draggingFilterId, setDraggingFilterId] = useState(null);
    const [dropTargetFilterId, setDropTargetFilterId] = useState(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    useEffect(() => {
        if (!isMobile)
            setMobileFiltersOpen(false);
    }, [isMobile]);
    useEffect(() => {
        if (openFilter !== 'author')
            setAuthorFilterQuery('');
    }, [openFilter]);
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
        return () => window.clearTimeout(t);
    }, [search]);
    const [listTotal, setListTotal] = useState(null);
    const [listPage, setListPage] = useState(1);
    const [hydratedFilterOwnerKey, setHydratedFilterOwnerKey] = useState(null);
    useEffect(() => {
        if (!filterOwnerKey || filterStorageUserId == null)
            return;
        if (hydratedFilterOwnerKey === filterOwnerKey)
            return;
        const defaults = defaultExpensesSavedFilters();
        setSearch(defaults.search);
        setDebouncedSearch(defaults.search.trim());
        setFilterStatus(defaults.status);
        setFilterType(defaults.type);
        setFilterSubtype(defaults.subtype);
        setFilterPartnerUserId(defaults.partnerUserId);
        setFilterAuthorUserId(defaults.authorUserId);
        setFilterReimb(defaults.reimbursable);
        setFilterPeriod(defaults.period);
        setFilterDateFrom(defaults.dateFrom);
        setFilterDateTo(defaults.dateTo);
        setFilterSort(defaults.sortBy);
        setListPage(1);
        clearExpensesSavedFilters(filterStorageUserId, variant);
        setHydratedFilterOwnerKey(filterOwnerKey);
    }, [filterOwnerKey, filterStorageUserId, variant, hydratedFilterOwnerKey]);
    useEffect(() => {
        if (!filterOwnerKey || hydratedFilterOwnerKey !== filterOwnerKey)
            return;
        if (isModerationQueue)
            return;
        const focus = searchParams.get('focus');
        if (focus === 'pay') {
            setFilterStatus(AWAITING_REIMBURSEMENT_STATUS_FILTER);
            setListPage(1);
        }
    }, [filterOwnerKey, hydratedFilterOwnerKey, isModerationQueue, searchParams]);
    const filterDepsKey = useMemo(() => [
        debouncedSearch,
        filterStatus,
        filterType,
        filterSubtype,
        filterPartnerUserId,
        filterAuthorUserId,
        filterReimb,
        filterPeriod,
        filterDateFrom,
        filterDateTo,
        filterSort,
        isModerationQueue,
        isPartnerScope,
        scopeMode ?? '',
    ].join('\0'), [debouncedSearch, filterStatus, filterType, filterSubtype, filterPartnerUserId, filterAuthorUserId, filterReimb, filterPeriod, filterDateFrom, filterDateTo, filterSort, isModerationQueue, isPartnerScope, scopeMode]);
    const statusFacetDepsKey = useMemo(() => [
        debouncedSearch,
        filterType,
        filterSubtype,
        filterPartnerUserId,
        filterAuthorUserId,
        filterReimb,
        filterPeriod,
        filterDateFrom,
        filterDateTo,
        filterSort,
        isPartnerScope,
        isClientScope,
        scopeMode ?? '',
    ].join('\0'), [debouncedSearch, filterType, filterSubtype, filterPartnerUserId, filterAuthorUserId, filterReimb, filterPeriod, filterDateFrom, filterDateTo, filterSort, isPartnerScope, isClientScope, scopeMode]);
    const [statusCounts, setStatusCounts] = useState({});
    useEffect(() => {
        setExpenseTableMenuForId(null);
    }, [listPage, filterDepsKey, loadKey]);
    useEffect(() => {
        if (isModerationQueue)
            return;
        if (!filterOwnerKey || hydratedFilterOwnerKey !== filterOwnerKey)
            return;
        let cancelled = false;
        const controller = new AbortController();
        void fetchExpenseStatusCounts({
            search: debouncedSearch,
            filterType: isClientScope ? '' : filterType,
            filterSubtype,
            filterPartnerUserId,
            filterAuthorUserId: canModerate ? filterAuthorUserId : '',
            filterReimb,
            filterPeriod,
            filterDateFrom,
            filterDateTo,
            sortBy: filterSort,
            scopeMode,
            forceExpenseType: isClientScope ? 'client_expense' : undefined,
        }, { signal: controller.signal, getReuseWindowMs: 0 })
            .then((next) => {
            if (!cancelled)
                setStatusCounts(next);
        })
            .catch((err) => {
            if (cancelled || (err instanceof Error && err.name === 'AbortError'))
                return;
            if (!cancelled)
                setStatusCounts({});
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [
        statusFacetDepsKey,
        loadKey,
        filterOwnerKey,
        hydratedFilterOwnerKey,
        isModerationQueue,
        isClientScope,
        canModerate,
        debouncedSearch,
        filterType,
        filterSubtype,
        filterPartnerUserId,
        filterAuthorUserId,
        filterReimb,
        filterPeriod,
        filterDateFrom,
        filterDateTo,
        filterSort,
        scopeMode,
    ]);
    useEffect(() => {
        if (!isPartnerScope)
            return;
        let cancelled = false;
        void listPartners()
            .then((rows) => {
            if (!cancelled)
                setPartnerFilterOptions(Array.isArray(rows) ? rows : []);
        })
            .catch(() => {
            if (!cancelled)
                setPartnerFilterOptions([]);
        });
        return () => {
            cancelled = true;
        };
    }, [isPartnerScope]);
    useEffect(() => {
        if (!canModerate)
            return;
        let cancelled = false;
        void listColleaguesAsUsers()
            .then((rows) => {
            if (cancelled)
                return;
            setAuthorFilterOptions((Array.isArray(rows) ? rows : []).filter((u) => !isHiddenSystemUser(u) && !u.is_blocked && !u.is_archived));
        })
            .catch(() => {
            if (!cancelled)
                setAuthorFilterOptions([]);
        });
        return () => {
            cancelled = true;
        };
    }, [canModerate]);
    const filterDepsKeyRef = useRef(null);
    useLayoutEffect(() => {
        if (filterDepsKeyRef.current === null) {
            filterDepsKeyRef.current = filterDepsKey;
            return;
        }
        if (filterDepsKeyRef.current !== filterDepsKey) {
            filterDepsKeyRef.current = filterDepsKey;
            setListPage(1);
        }
    }, [filterDepsKey]);
    const listPageScrollRef = useRef(true);
    useEffect(() => {
        if (listPageScrollRef.current) {
            listPageScrollRef.current = false;
            return;
        }
        const content = document.querySelector('.expenses-page__content');
        const main = document.querySelector('.expenses-page__main');
        const behavior = 'smooth';
        content?.scrollTo({ top: 0, left: 0, behavior });
        main?.scrollTo({ top: 0, left: 0, behavior });
        if (window.scrollY > 0)
            window.scrollTo({ top: 0, left: 0, behavior });
    }, [listPage]);
    useEffect(() => {
        if (!filterOwnerKey || hydratedFilterOwnerKey !== filterOwnerKey)
            return;
        let cancelled = false;
        const controller = new AbortController();
        setLoadError(null);
        if (isFirstListFetchRef.current)
            setIsLoading(true);
        setListFetchPending(true);
        const params = buildExpensesListParams({
            isModerationQueue,
            search: debouncedSearch,
            filterStatus,
            filterType: isClientScope ? '' : filterType,
            filterSubtype,
            filterPartnerUserId,
            filterAuthorUserId: canModerate ? filterAuthorUserId : '',
            filterReimb,
            filterPeriod,
            filterDateFrom,
            filterDateTo,
            sortBy: filterSort,
            page: listPage,
            pageSize: EXPENSES_LIST_PAGE_SIZE,
            scopeMode,
            forceExpenseType: isClientScope ? 'client_expense' : undefined,
        });
        fetchExpenses(params, { signal: controller.signal, getReuseWindowMs: 0 })
            .then(data => {
            if (cancelled)
                return;
            const nextTotal = typeof data.total === 'number' ? data.total : 0;
            const lastAvailablePage = Math.max(1, Math.ceil(nextTotal / EXPENSES_LIST_PAGE_SIZE));
            if (listPage > lastAvailablePage) {
                setListPage(lastAvailablePage);
                return;
            }
            isFirstListFetchRef.current = false;
            setRequests(Array.isArray(data.items) ? data.items : []);
            setListTotal(typeof data.total === 'number' ? data.total : null);
            setIsLoading(false);
            setListFetchPending(false);
        })
            .catch(err => {
            if (cancelled || (err instanceof Error && err.name === 'AbortError'))
                return;
            setListTotal(null);
            setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
            isFirstListFetchRef.current = false;
            setIsLoading(false);
            setListFetchPending(false);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [
        loadKey,
        listPage,
        isModerationQueue,
        isPartnerScope,
        isClientScope,
        scopeMode,
        debouncedSearch,
        filterStatus,
        filterType,
        filterSubtype,
        filterPartnerUserId,
        filterAuthorUserId,
        canModerate,
        filterReimb,
        filterPeriod,
        filterDateFrom,
        filterDateTo,
        filterSort,
        filterOwnerKey,
        hydratedFilterOwnerKey,
    ]);
    useEffect(() => {
        if (isModerationQueue)
            setFilterStatus('');
    }, [isModerationQueue]);
    useEffect(() => {
        if (!isModerationQueue && filterStatus && !isExpensesUiStatusFilter(filterStatus)) {
            setFilterStatus('');
        }
    }, [isModerationQueue, filterStatus]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [panelMounted, setPanelMounted] = useState(false);
    const isPanelOpenRef = useRef(false);
    isPanelOpenRef.current = isPanelOpen;
    const [highlightedRequestId, setHighlightedRequestId] = useState(null);
    const [panelMode, setPanelMode] = useState('create');
    const [editingReq, setEditingReq] = useState(null);
    const [panelSavePending, setPanelSavePending] = useState(false);
    const [panelSubmitPending, setPanelSubmitPending] = useState(false);
    const [receiptUploadPending, setReceiptUploadPending] = useState(false);
    const panelFormActionRef = useRef('idle');
    const panelDataGenRef = useRef(0);
    const [emailModerationIntent, setEmailModerationIntent] = useState(null);
    const openedExpensePathRef = useRef(null);
    useEffect(() => {
        if (isPanelOpen)
            setPanelMounted(true);
    }, [isPanelOpen]);
    useEffect(() => {
        if (!isPanelOpen) {
            panelFormActionRef.current = 'idle';
            setPanelSavePending(false);
            setPanelSubmitPending(false);
            setReceiptUploadPending(false);
        }
    }, [isPanelOpen]);
    useEffect(() => {
        const candidates = [];
        if (Array.isArray(requests))
            candidates.push(...requests);
        if (editingReq)
            candidates.push(editingReq);
        if (candidates.length === 0)
            return;
        const pending = [];
        for (const r of candidates) {
            if (r == null || typeof r !== 'object')
                continue;
            try {
                const n = normalizeExpenseRequest(r);
                if (!needsAuthorEnrichment(n)) {
                    const approvedId = n.approvedByUserId ?? null;
                    const approvedKnown = approvedId != null
                        && (n.approvedBy?.displayName?.trim()
                            || n.approvedBy?.email?.trim());
                    if (approvedId != null && approvedId > 0 && !approvedKnown && !authorFetchStartedRef.current.has(approvedId)) {
                        authorFetchStartedRef.current.add(approvedId);
                        pending.push(approvedId);
                    }
                    continue;
                }
                const id = n.createdByUserId;
                if (!authorFetchStartedRef.current.has(id)) {
                    authorFetchStartedRef.current.add(id);
                    pending.push(id);
                }
                const approvedId = n.approvedByUserId ?? null;
                const approvedKnown = approvedId != null
                    && (n.approvedBy?.displayName?.trim()
                        || n.approvedBy?.email?.trim());
                if (approvedId != null && approvedId > 0 && !approvedKnown && !authorFetchStartedRef.current.has(approvedId)) {
                    authorFetchStartedRef.current.add(approvedId);
                    pending.push(approvedId);
                }
            }
            catch {
            }
        }
        if (pending.length === 0)
            return;
        let cancelled = false;
        void loadPublicUsersByIds(pending).then((loaded) => {
            if (cancelled)
                return;
            const next = {};
            for (const id of pending) {
                const user = loaded.get(id);
                if (!user) {
                    authorFetchStartedRef.current.delete(id);
                    continue;
                }
                next[id] = {
                    id: user.id,
                    displayName: user.display_name,
                    email: user.email,
                    picture: user.picture,
                    position: user.position,
                };
            }
            if (Object.keys(next).length > 0) {
                setAuthorCache(prev => ({ ...prev, ...next }));
            }
        });
        return () => { cancelled = true; };
    }, [requests, editingReq]);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [tableModerationBusyId, setTableModerationBusyId] = useState(null);
    const [tableReject, setTableReject] = useState(null);
    const [tableRevise, setTableRevise] = useState(null);
    const [tableRejectReason, setTableRejectReason] = useState('');
    const [tableReviseComment, setTableReviseComment] = useState('');
    const [tableModErr, setTableModErr] = useState(null);
    const [tableConfirm, setTableConfirm] = useState(null);
    useEffect(() => {
        if (!openFilter)
            return;
        const handler = () => setOpenFilter(null);
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openFilter]);
    const availableFilterSlots = useMemo(() => availableExpensesFilterSlots({ variant, canModerate }), [variant, canModerate]);
    useEffect(() => {
        if (filterStorageUserId == null) {
            setFilterOrder(availableFilterSlots);
            return;
        }
        const saved = loadExpensesFilterOrder(filterStorageUserId, variant);
        setFilterOrder(mergeExpensesFilterOrder(saved, availableFilterSlots));
    }, [filterStorageUserId, variant, availableFilterSlots]);
    const persistFilterOrder = useCallback((order) => {
        if (filterStorageUserId != null)
            saveExpensesFilterOrder(filterStorageUserId, variant, order);
    }, [filterStorageUserId, variant]);
    const handleFilterDragStart = useCallback((e, id) => {
        setOpenFilter(null);
        setDraggingFilterId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(FILTER_DRAG_MIME, id);
        e.dataTransfer.setData('text/plain', id);
    }, []);
    const handleFilterDragEnd = useCallback(() => {
        setDraggingFilterId(null);
        setDropTargetFilterId(null);
    }, []);
    const handleFilterDragOver = useCallback((e, id) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetFilterId(id);
    }, []);
    const handleFilterDrop = useCallback((e, targetId) => {
        e.preventDefault();
        const raw = (e.dataTransfer.getData(FILTER_DRAG_MIME) || e.dataTransfer.getData('text/plain') || draggingFilterId);
        if (!raw || raw === targetId) {
            handleFilterDragEnd();
            return;
        }
        setFilterOrder((prev) => {
            const next = reorderExpensesFilterOrder(prev, raw, targetId);
            persistFilterOrder(next);
            return next;
        });
        handleFilterDragEnd();
    }, [draggingFilterId, handleFilterDragEnd, persistFilterOrder]);
    const toggleFilter = useCallback((f) => {
        setOpenFilter(prev => prev === f ? null : f);
    }, []);
    const filterDragProps = useMemo(() => ({
        onDragStartSlot: handleFilterDragStart,
        onDragOverSlot: handleFilterDragOver,
        onDropSlot: handleFilterDrop,
        onDragEndSlot: handleFilterDragEnd,
    }), [handleFilterDragStart, handleFilterDragOver, handleFilterDrop, handleFilterDragEnd]);
    const handleCreate = useCallback(() => {
        setEditingReq(null);
        setPanelMode('create');
        setIsPanelOpen(true);
    }, []);
    const handleOpenReq = useCallback((req, opts) => {
        setExpenseTableMenuForId(null);
        setHighlightedRequestId(req.id);
        const auto = resolveExpensePanelMode(req.status) === 'edit' ? 'edit' : 'view';
        const mode = opts?.mode ?? auto;
        const gen = ++panelDataGenRef.current;
        if (mode === 'edit' && req.reimbursementCardNumber === undefined) {
            fetchExpenseById(req.id)
                .then(full => {
                if (panelDataGenRef.current !== gen)
                    return;
                setEditingReq(full);
                setPanelMode(mode);
                setIsPanelOpen(true);
            })
                .catch(() => {
                if (panelDataGenRef.current !== gen)
                    return;
                setEditingReq(req);
                setPanelMode(mode);
                setIsPanelOpen(true);
            });
            return;
        }
        setEditingReq(req);
        setPanelMode(mode);
        setIsPanelOpen(true);
        if (mode === 'view') {
            fetchExpenseById(req.id)
                .then(full => {
                if (panelDataGenRef.current !== gen)
                    return;
                setEditingReq(prev => (prev?.id === full.id ? full : prev));
            })
                .catch(() => { });
        }
    }, []);
    useEffect(() => {
        if (!pathExpenseId) {
            openedExpensePathRef.current = null;
        }
    }, [pathExpenseId]);
    useEffect(() => {
        if (!pathExpenseId || isLoading)
            return;
        if (openedExpensePathRef.current === pathExpenseId)
            return;
        let cancelled = false;
        const intentRaw = searchParams.get('intent');
        const intentParsed = intentRaw === 'approve' || intentRaw === 'reject' || intentRaw === 'pay' ? intentRaw : null;
        const stripSearch = searchParams.toString().length > 0;
        (async () => {
            try {
                const req = await fetchExpenseById(pathExpenseId);
                if (cancelled)
                    return;
                openedExpensePathRef.current = pathExpenseId;
                const intentMatchesStatus = intentParsed === 'pay'
                    ? req.status === 'approved'
                    : req.status === 'pending_approval';
                if (intentParsed && intentMatchesStatus) {
                    const blockedOwn = isModerationBlockedForOwnExpense(canModerate, user?.id, req);
                    const allowIntent = intentParsed === 'pay'
                        ? showPayExpenseAction(req, blockedOwn, { isPaymentConfirmer, canModerate })
                        : canModerate;
                    if (allowIntent)
                        setEmailModerationIntent(intentParsed);
                    else
                        setEmailModerationIntent(null);
                }
                else {
                    setEmailModerationIntent(null);
                }
                handleOpenReq(req);
                if (stripSearch) {
                    navigate({ pathname: getExpensesOpenUrl(pathExpenseId), search: '' }, { replace: true });
                }
            }
            catch {
                if (!cancelled) {
                    setActionError('Не удалось открыть заявку по ссылке');
                    navigate(routes.expenses, { replace: true });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pathExpenseId, isLoading, searchParams, navigate, handleOpenReq, canModerate, isPaymentConfirmer]);
    const handleClosePanel = useCallback(() => {
        setIsPanelOpen(false);
        setEmailModerationIntent(null);
    }, []);
    const applyModerationToList = useCallback((r) => {
        setRequests(prev => {
            // Moderation queue only shows pending_approval — drop row after decision.
            if (isModerationQueue && r.status !== 'pending_approval') {
                return prev.filter(x => x.id !== r.id);
            }
            return prev.map(x => (x.id === r.id ? r : x));
        });
        setEditingReq(prev => (prev?.id === r.id ? r : prev));
        setLoadKey(k => k + 1);
    }, [isModerationQueue]);
    const handleExpenseUpdated = useCallback((r) => {
        applyModerationToList(r);
        setIsPanelOpen(false);
    }, [applyModerationToList]);
    const handleTableApprove = useCallback((req) => {
        if (tableModerationBusyId)
            return;
        setTableConfirm({ kind: 'approve', req });
    }, [tableModerationBusyId]);
    const handleTablePay = useCallback((req) => {
        if (tableModerationBusyId)
            return;
        setTableConfirm({ kind: 'pay', req });
    }, [tableModerationBusyId]);
    const handleTableDeleteClick = useCallback((req) => {
        if (tableModerationBusyId)
            return;
        setTableConfirm({ kind: 'delete', req });
    }, [tableModerationBusyId]);
    const handleExpenseDeleted = useCallback((id) => {
        setRequests(prev => prev.filter(x => x.id !== id));
        setEditingReq(prev => (prev?.id === id ? null : prev));
        setHighlightedRequestId(prev => (prev === id ? null : prev));
        setIsPanelOpen(false);
        setExpenseTableMenuForId(null);
        setLoadKey(k => k + 1);
    }, []);
    const runTableConfirm = useCallback(async () => {
        if (!tableConfirm || tableModerationBusyId)
            return;
        const { req } = tableConfirm;
        setTableModerationBusyId(req.id);
        setActionError(null);
        try {
            let r;
            if (tableConfirm.kind === 'approve') {
                r = await approveExpense(req.id);
            }
            else if (tableConfirm.kind === 'pay') {
                r = await payExpense(req.id);
            }
            else {
                await deleteExpense(req.id);
                handleExpenseDeleted(req.id);
                setTableConfirm(null);
                return;
            }
            applyModerationToList(r);
            setTableConfirm(null);
        }
        catch (e) {
            const fallback = tableConfirm.kind === 'approve'
                ? 'Не удалось одобрить заявку'
                : tableConfirm.kind === 'pay'
                    ? 'Не удалось отметить оплату'
                    : 'Не удалось удалить заявку';
            setActionError(e instanceof Error ? e.message : fallback);
            setTableConfirm(null);
        }
        finally {
            setTableModerationBusyId(null);
        }
    }, [tableConfirm, tableModerationBusyId, applyModerationToList, handleExpenseDeleted]);
    const openTableReject = useCallback((req) => {
        setTableReject(req);
        setTableRejectReason('');
        setTableModErr(null);
    }, []);
    const openTableRevise = useCallback((req) => {
        setTableRevise(req);
        setTableReviseComment('');
        setTableModErr(null);
    }, []);
    const confirmTableReject = useCallback(async () => {
        if (!tableReject || tableModerationBusyId)
            return;
        const t = tableRejectReason.trim();
        if (!t) {
            setTableModErr('Укажите причину отклонения');
            return;
        }
        setTableModerationBusyId(tableReject.id);
        setTableModErr(null);
        try {
            const r = await rejectExpense(tableReject.id, t);
            applyModerationToList(r);
            setTableReject(null);
            setTableRejectReason('');
        }
        catch (e) {
            setTableModErr(e instanceof Error ? e.message : 'Не удалось отклонить заявку');
        }
        finally {
            setTableModerationBusyId(null);
        }
    }, [tableReject, tableRejectReason, tableModerationBusyId, applyModerationToList]);
    const confirmTableRevise = useCallback(async () => {
        if (!tableRevise || tableModerationBusyId)
            return;
        const t = tableReviseComment.trim();
        if (!t) {
            setTableModErr('Укажите комментарий для автора');
            return;
        }
        setTableModerationBusyId(tableRevise.id);
        setTableModErr(null);
        try {
            const r = await reviseExpense(tableRevise.id, t);
            applyModerationToList(r);
            setTableRevise(null);
            setTableReviseComment('');
        }
        catch (e) {
            setTableModErr(e instanceof Error ? e.message : 'Не удалось вернуть заявку на доработку');
        }
        finally {
            setTableModerationBusyId(null);
        }
    }, [tableRevise, tableReviseComment, tableModerationBusyId, applyModerationToList]);
    const tableModBusy = tableModerationBusyId !== null;
    const tableOverlayOpen = Boolean(tableReject || tableRevise || tableConfirm);
    useEffect(() => {
        if (!tableOverlayOpen)
            return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [tableOverlayOpen]);
    const handleSaveDraft = useCallback(async (values, filesByKind) => {
        if (panelFormActionRef.current !== 'idle')
            return;
        panelFormActionRef.current = 'save';
        setPanelSavePending(true);
        setActionError(null);
        try {
            await saveExpenseFromForm({
                values,
                files: filesByKind,
                expenseId: editingReq?.id ?? null,
                submit: false,
            });
            setListPage(1);
            setLoadKey(k => k + 1);
            setIsPanelOpen(false);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Ошибка при сохранении');
        }
        finally {
            panelFormActionRef.current = 'idle';
            setPanelSavePending(false);
        }
    }, [editingReq]);
    const handleSubmit = useCallback(async (values, filesByKind) => {
        if (panelFormActionRef.current !== 'idle')
            return;
        panelFormActionRef.current = 'submit';
        setPanelSubmitPending(true);
        setActionError(null);
        try {
            await saveExpenseFromForm({
                values,
                files: filesByKind,
                expenseId: editingReq?.id ?? null,
                submit: true,
            });
            setListPage(1);
            setLoadKey(k => k + 1);
            setIsPanelOpen(false);
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Ошибка при отправке');
        }
        finally {
            panelFormActionRef.current = 'idle';
            setPanelSubmitPending(false);
        }
    }, [editingReq]);
    const resetFilters = useCallback(() => {
        setFilterStatus('');
        setFilterType('');
        setFilterSubtype('');
        setFilterPartnerUserId('');
        setFilterAuthorUserId('');
        setFilterReimb('');
        setFilterPeriod('all');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterSort('createdAt');
        setSearch('');
    }, []);
    const selectCustomPeriod = useCallback(() => {
        setFilterPeriod('custom');
        setFilterDateFrom((prev) => {
            if (prev.trim())
                return prev;
            return defaultExpensesCustomRange().dateFrom;
        });
        setFilterDateTo((prev) => {
            if (prev.trim())
                return prev;
            return defaultExpensesCustomRange().dateTo;
        });
        setOpenFilter(null);
    }, []);
    const requestsForUi = useMemo(() => {
        if (!Array.isArray(requests))
            return [];
        return requests
            .filter((r) => r != null && typeof r === 'object')
            .map(r => {
            try {
                const n = normalizeExpenseRequest(r);
                const withAuthor = mergeExpenseAuthorFromCache(n, authorCache);
                const approvedId = withAuthor.approvedByUserId ?? null;
                const approvedCached = approvedId != null ? authorCache[approvedId] : undefined;
                if (approvedCached && !(withAuthor.approvedBy?.displayName?.trim() || withAuthor.approvedBy?.email?.trim())) {
                    return {
                        ...withAuthor,
                        approvedBy: {
                            id: approvedId ?? approvedCached.id,
                            displayName: approvedCached.displayName ?? null,
                            email: approvedCached.email ?? null,
                            picture: approvedCached.picture ?? null,
                            position: approvedCached.position ?? null,
                        },
                    };
                }
                return withAuthor;
            }
            catch {
                return null;
            }
        })
            .filter((r) => r !== null);
    }, [requests, authorCache]);
    const editingRequestForPanel = useMemo(() => {
        if (!editingReq)
            return null;
        try {
            return mergeExpenseAuthorFromCache(normalizeExpenseRequest(editingReq), authorCache);
        }
        catch {
            return mergeExpenseAuthorFromCache(editingReq, authorCache);
        }
    }, [editingReq, authorCache]);
    const allowPaymentReceiptUpload = useMemo(() => {
        if (!editingReq || user == null)
            return false;
        if (!isReceiptUploadAllowedForExpenseStatus(editingReq.status))
            return false;
        if (user.id === editingReq.createdByUserId)
            return true;
        if (!canModerate)
            return false;
        return !isModerationBlockedForOwnExpense(canModerate, user.id, editingReq);
    }, [editingReq, user, canModerate]);
    const handleUploadPaymentReceipts = useCallback(async (files) => {
        if (!editingReq || files.length === 0)
            return;
        const existing = editingReq.attachments?.length ?? editingReq.attachmentsCount ?? 0;
        if (existing + files.length > EXPENSE_ATTACHMENT_MAX_COUNT) {
            setActionError(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG);
            throw new Error(EXPENSE_ATTACHMENT_COUNT_LIMIT_MSG);
        }
        setReceiptUploadPending(true);
        setActionError(null);
        try {
            let last = editingReq;
            for (const file of files) {
                last = await uploadAttachment(last.id, file, 'payment_receipt');
            }
            setEditingReq(last);
            setRequests(prev => prev.map(r => (r.id === last.id ? last : r)));
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Не удалось загрузить квитанцию');
            throw err;
        }
        finally {
            setReceiptUploadPending(false);
        }
    }, [editingReq]);
    // Show all rows returned by the API. Registry status set is only for the
    // status filter dropdown — do not hide draft / pending_approval here
    // (that caused «1 заявка» in stats with an empty table after create).
    const filtered = requestsForUi;
    const hasFilters = isModerationQueue
        ? !!(filterAuthorUserId || filterType || filterReimb || filterPeriod !== 'all' || filterSort !== 'createdAt' || search)
        : isPartnerScope
            ? !!(filterStatus || filterSubtype || filterPartnerUserId || filterAuthorUserId || filterReimb || filterPeriod !== 'all' || filterSort !== 'createdAt' || search)
            : isClientScope
                ? !!(filterStatus || filterAuthorUserId || filterReimb || filterPeriod !== 'all' || filterSort !== 'createdAt' || search)
                : !!(filterStatus || filterType || filterAuthorUserId || filterReimb || filterPeriod !== 'all' || filterSort !== 'createdAt' || search);
    const activeFilterChipCount = useMemo(() => {
        let n = 0;
        if (!isModerationQueue && filterStatus)
            n++;
        if (isPartnerScope) {
            if (filterSubtype)
                n++;
            if (filterPartnerUserId)
                n++;
        }
        else if (!isClientScope && filterType) {
            n++;
        }
        if (canModerate && filterAuthorUserId)
            n++;
        if (filterReimb)
            n++;
        if (filterPeriod !== 'all')
            n++;
        if (filterSort !== 'createdAt')
            n++;
        return n;
    }, [isModerationQueue, isPartnerScope, isClientScope, canModerate, filterStatus, filterType, filterSubtype, filterPartnerUserId, filterAuthorUserId, filterReimb, filterPeriod, filterSort]);
    const periodFilterLabel = useMemo(() => expensesPeriodFilterLabel(filterPeriod, filterDateFrom, filterDateTo), [filterPeriod, filterDateFrom, filterDateTo]);
    const statuses = EXPENSE_STATUS_FILTER_OPTIONS;
    const types = [
        ...COMPANY_EXPENSE_TYPE_CODES,
        ...(isPartnerOrgRole(user?.role, user?.position) || canManageCompanyExpense(user?.email)
            ? [COMPANY_PRIVATE_EXPENSE_TYPE.value]
            : []),
    ];
    const partnerFilterLabel = useMemo(() => {
        if (!filterPartnerUserId)
            return 'Партнёр';
        const p = partnerFilterOptions.find(x => x.id === filterPartnerUserId);
        return p?.display_name?.trim() || p?.email || `Партнёр #${filterPartnerUserId}`;
    }, [filterPartnerUserId, partnerFilterOptions]);
    const authorFilterChipLabel = useMemo(() => {
        if (!filterAuthorUserId)
            return 'Автор';
        const u = authorFilterOptions.find(x => x.id === filterAuthorUserId);
        if (u)
            return authorFilterLabel(u);
        return `Автор #${filterAuthorUserId}`;
    }, [filterAuthorUserId, authorFilterOptions]);
    const filteredAuthorOptions = useMemo(() => {
        const q = authorFilterQuery.trim().toLowerCase();
        if (!q)
            return authorFilterOptions;
        return authorFilterOptions.filter((u) => {
            const hay = [u.display_name, u.email, String(u.id)].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [authorFilterOptions, authorFilterQuery]);
    const renderFilterSlot = (slotId) => {
        const drag = {
            ...filterDragProps,
            dragging: draggingFilterId === slotId,
            dropTarget: dropTargetFilterId === slotId && draggingFilterId !== slotId,
        };
        switch (slotId) {
            case 'status': {
                const allCountLabel = isPaymentConfirmer
                    ? formatExpenseStatusCount(statusCounts[AWAITING_REIMBURSEMENT_STATUS_FILTER] ?? payCount)
                    : formatExpenseStatusCount(statusCounts.all);
                const pendingCount = statusCounts.pending_approval ?? moderationCount;
                const statusChipBadge = filterStatus
                    ? (statusCounts[filterStatus] ?? 0)
                    : (isPaymentConfirmer ? payCount : (canModerate ? pendingCount : 0));
                return (_jsxs(FilterDrop, { slotId: slotId, label: filterStatus ? expenseUiStatusFilterLabel(filterStatus) : 'Статус', active: !!filterStatus, isOpen: openFilter === 'status', onToggle: () => toggleFilter('status'), badgeCount: statusChipBadge, ...drag, children: [_jsxs("button", { className: `exp-filter__opt${!filterStatus ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterStatus(''); setOpenFilter(null); }, children: [_jsx("span", { className: "exp-filter__opt-label", children: "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B" }), allCountLabel ? (_jsx("span", { className: "app-count-badge exp-filter__opt-badge", "aria-label": `Всего ${allCountLabel}`, children: allCountLabel })) : null] }), statuses.map(s => {
                            const countForOption = isPaymentConfirmer && s.value !== AWAITING_REIMBURSEMENT_STATUS_FILTER
                                ? undefined
                                : statusCounts[s.value];
                            const countLabel = formatExpenseStatusCount(countForOption);
                            return (_jsxs("button", { className: `exp-filter__opt${filterStatus === s.value ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterStatus(s.value); setOpenFilter(null); }, children: [_jsx("span", { className: `exp-filter__dot exp-filter__dot--${s.value}` }), _jsx("span", { className: "exp-filter__opt-label", children: s.label }), countLabel ? (_jsx("span", { className: "app-count-badge exp-filter__opt-badge", "aria-label": `${s.label}: ${countLabel}`, children: countLabel })) : null] }, s.value));
                        })] }, slotId));
            }
            case 'type':
                return (_jsxs(FilterDrop, { slotId: slotId, label: filterType ? TYPE_META[filterType].label : 'Тип расхода', active: !!filterType, isOpen: openFilter === 'type', onToggle: () => toggleFilter('type'), ...drag, children: [_jsx("button", { className: `exp-filter__opt${!filterType ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterType(''); setOpenFilter(null); }, children: "\u0412\u0441\u0435 \u0442\u0438\u043F\u044B" }), types.map(t => (_jsx("button", { className: `exp-filter__opt${filterType === t ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterType(t); setOpenFilter(null); }, children: TYPE_META[t].label }, t)))] }, slotId));
            case 'subtype':
                return (_jsxs(FilterDrop, { slotId: slotId, label: filterSubtype ? getPartnerExpenseSubtypeLabel(filterSubtype) : 'Категория', active: !!filterSubtype, isOpen: openFilter === 'subtype', onToggle: () => toggleFilter('subtype'), ...drag, children: [_jsx("button", { className: `exp-filter__opt${!filterSubtype ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterSubtype(''); setOpenFilter(null); }, children: "\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438" }), PARTNER_EXPENSE_CATEGORIES.map(c => (_jsx("button", { className: `exp-filter__opt${filterSubtype === c.value ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterSubtype(c.value); setOpenFilter(null); }, children: c.label }, c.value)))] }, slotId));
            case 'partner':
                return (_jsxs(FilterDrop, { slotId: slotId, label: partnerFilterLabel, active: !!filterPartnerUserId, isOpen: openFilter === 'partner', onToggle: () => toggleFilter('partner'), ...drag, children: [_jsx("button", { className: `exp-filter__opt${!filterPartnerUserId ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterPartnerUserId(''); setOpenFilter(null); }, children: "\u0412\u0441\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u044B" }), partnerFilterOptions.map(p => (_jsx("button", { className: `exp-filter__opt${filterPartnerUserId === p.id ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterPartnerUserId(p.id); setOpenFilter(null); }, children: p.display_name?.trim() || p.email || `#${p.id}` }, p.id)))] }, slotId));
            case 'author':
                return (_jsxs(FilterDrop, { slotId: slotId, label: authorFilterChipLabel, active: !!filterAuthorUserId, isOpen: openFilter === 'author', onToggle: () => toggleFilter('author'), wide: true, ...drag, children: [_jsx("div", { className: "exp-filter__author-search", onClick: (e) => e.stopPropagation(), children: _jsx("input", { type: "search", className: "exp-filter__author-search-input", placeholder: "\u041F\u043E\u0438\u0441\u043A \u0430\u0432\u0442\u043E\u0440\u0430\u2026", value: authorFilterQuery, onChange: (e) => setAuthorFilterQuery(e.target.value), "aria-label": "\u041F\u043E\u0438\u0441\u043A \u0430\u0432\u0442\u043E\u0440\u0430" }) }), _jsxs("div", { className: "exp-filter__author-list", children: [_jsx("button", { type: "button", className: `exp-filter__opt${!filterAuthorUserId ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterAuthorUserId(''); setOpenFilter(null); }, children: "\u0412\u0441\u0435 \u0430\u0432\u0442\u043E\u0440\u044B" }), filteredAuthorOptions.map(u => (_jsx("button", { type: "button", className: `exp-filter__opt${filterAuthorUserId === u.id ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterAuthorUserId(u.id); setOpenFilter(null); }, children: _jsx("span", { className: "exp-filter__opt-label", children: authorFilterLabel(u) }) }, u.id))), filteredAuthorOptions.length === 0 && (_jsx("p", { className: "exp-filter__empty", role: "status", children: "\u041D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }))] })] }, slotId));
            case 'reimbursable':
                return (_jsxs(FilterDrop, { slotId: slotId, label: filterReimb ? REIMBURSABLE_META[filterReimb].label : 'Возмещение', active: !!filterReimb, isOpen: openFilter === 'reimbursable', onToggle: () => toggleFilter('reimbursable'), ...drag, children: [_jsx("button", { className: `exp-filter__opt${!filterReimb ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterReimb(''); setOpenFilter(null); }, children: "\u041B\u044E\u0431\u043E\u0435" }), _jsx("button", { className: `exp-filter__opt${filterReimb === 'reimbursable' ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterReimb('reimbursable'); setOpenFilter(null); }, children: REIMBURSABLE_META.reimbursable.label }), _jsx("button", { className: `exp-filter__opt${filterReimb === 'non_reimbursable' ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterReimb('non_reimbursable'); setOpenFilter(null); }, children: REIMBURSABLE_META.non_reimbursable.label })] }, slotId));
            case 'period':
                return (_jsxs(FilterDrop, { slotId: slotId, label: periodFilterLabel, active: filterPeriod !== 'all', isOpen: openFilter === 'period', onToggle: () => toggleFilter('period'), ...drag, children: [_jsx("button", { className: `exp-filter__opt${filterPeriod === 'all' ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterPeriod('all'); setOpenFilter(null); }, children: EXPENSES_PERIOD_LABELS.all }), EXPENSES_PERIOD_PRESET_IDS.map(p => (_jsx("button", { className: `exp-filter__opt${filterPeriod === p ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterPeriod(p); setOpenFilter(null); }, children: EXPENSES_PERIOD_LABELS[p] }, p))), _jsx("div", { className: "exp-filter__sep", role: "separator" }), _jsx("button", { className: `exp-filter__opt${filterPeriod === 'custom' ? ' exp-filter__opt--on' : ''}`, onClick: selectCustomPeriod, children: EXPENSES_PERIOD_LABELS.custom })] }, slotId));
            case 'sort':
                return (_jsx(FilterDrop, { slotId: slotId, label: SORT_LABELS[filterSort], active: filterSort !== 'createdAt', isOpen: openFilter === 'sort', onToggle: () => toggleFilter('sort'), ...drag, children: Object.keys(SORT_LABELS).map(sort => (_jsx("button", { className: `exp-filter__opt${filterSort === sort ? ' exp-filter__opt--on' : ''}`, onClick: () => { setFilterSort(sort); setOpenFilter(null); }, children: SORT_LABELS[sort] }, sort))) }, slotId));
            default:
                return null;
        }
    };
    return (_jsxs("div", { className: "expenses-page", children: [_jsxs("main", { className: "expenses-page__main", children: [_jsx("header", { className: "expenses-page__header", children: _jsxs("div", { className: "expenses-page__header-inner", children: [_jsxs("div", { className: "expenses-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { className: "expenses-page__header-titles", children: [_jsx("h1", { className: "expenses-page__title", children: isModerationQueue
                                                        ? 'Заявки на согласование'
                                                        : isPartnerScope
                                                            ? 'Расходы партнёров'
                                                            : isClientScope
                                                                ? 'Расходы за клиентов'
                                                                : 'Расходы компании' }), _jsxs("div", { className: "exp-header-queue-wrap", children: [!isPartnerScope && (_jsxs(_Fragment, { children: [canModerate && (_jsx(NavLink, { to: routes.expensesReport, className: "exp-queue-nav", children: "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430" })), _jsx(NavLink, { to: routes.expensesPartners, className: "exp-queue-nav", children: "\u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432" }), canSeeCash && (_jsx(NavLink, { to: routes.expensesCash, className: "exp-queue-nav", children: "\u041A\u0430\u0441\u0441\u0430" }))] })), isPartnerScope && (_jsxs(_Fragment, { children: [_jsx(NavLink, { to: routes.expenses, className: "exp-queue-nav", children: "\u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438" }), canModerate && (_jsx(NavLink, { to: routes.expensesReport, className: "exp-queue-nav", children: "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430" })), canModerate && (_jsx(NavLink, { to: routes.expensesPartnersReport, className: "exp-queue-nav", children: "\u041E\u0442\u0447\u0451\u0442" })), canSeeCash && (_jsx(NavLink, { to: routes.expensesCash, className: "exp-queue-nav", children: "\u041A\u0430\u0441\u0441\u0430" }))] }))] })] })] }), _jsx("div", { className: "app-page-header-end", children: _jsx(AppPageSettings, {}) })] }) }), _jsxs("div", { className: "expenses-page__content", children: [actionError && (_jsxs("div", { className: "exp-error-banner", role: "alert", children: [_jsx("span", { children: actionError }), _jsx("button", { type: "button", className: "exp-error-banner__close", onClick: () => setActionError(null), "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u2715" })] })), _jsxs("div", { className: `tt-settings__actions-row tt-settings__actions-row--clients exp-tt-toolbar${isLoading || listFetchPending ? ' exp-tt-toolbar--loading' : ''}`, children: [_jsxs("div", { className: "tt-settings__toolbar-left tt-settings__toolbar-left--inline", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", onClick: handleCreate, children: isPartnerScope ? '+ Записать расход' : '+ Создать заявку' }), canModerate && !isClientScope && (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline", onClick: () => {
                                                    if (isPartnerScope) {
                                                        navigate(routes.expensesPartnersReport);
                                                        return;
                                                    }
                                                    setIsReportOpen(true);
                                                }, title: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043E\u0442\u0447\u0451\u0442 Excel", "aria-label": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043E\u0442\u0447\u0451\u0442 Excel", children: "\u041E\u0442\u0447\u0451\u0442 Excel" }))] }), _jsxs("div", { className: "tt-settings__actions-end", children: [_jsxs("div", { className: "tt-settings__search-wrap", children: [_jsx("span", { className: "tt-settings__search-icon", "aria-hidden": true, children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })] }) }), _jsx("input", { type: "search", className: "tt-settings__search", placeholder: "\u041F\u043E \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044E, \u043D\u043E\u043C\u0435\u0440\u0443 \u0437\u0430\u044F\u0432\u043A\u0438 \u0438\u043B\u0438 \u0430\u0432\u0442\u043E\u0440\u0443", value: search, onChange: e => setSearch(e.target.value), "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0437\u0430\u044F\u0432\u043A\u0430\u043C" })] }), isMobile && (_jsxs("button", { type: "button", className: `exp-filters-toggle${activeFilterChipCount > 0 ? ' exp-filters-toggle--active' : ''}`, "aria-expanded": mobileFiltersOpen, onClick: () => {
                                                    setMobileFiltersOpen(v => {
                                                        const next = !v;
                                                        if (!next)
                                                            setOpenFilter(null);
                                                        return next;
                                                    });
                                                }, children: [_jsx("svg", { className: "exp-filters-toggle__icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" }) }), _jsx("span", { children: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B" }), activeFilterChipCount > 0 && (_jsx("span", { className: "exp-filters-toggle__badge", "aria-hidden": true, children: activeFilterChipCount }))] }))] })] }), _jsxs("div", { className: "exp-tt-filters-outer", onMouseDown: e => e.stopPropagation(), children: [_jsxs("div", { className: `exp-filters${isMobile && !mobileFiltersOpen ? ' exp-filters--mobile-collapsed' : ''}${draggingFilterId ? ' exp-filters--reordering' : ''}`, "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440\u044B (\u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u0442\u0430\u0441\u043A\u0438\u0432\u0430\u0442\u044C)", children: [filterOrder.map((slotId) => renderFilterSlot(slotId)), hasFilters && (_jsx("button", { type: "button", className: "exp-filters-reset", onClick: resetFilters, children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" }))] }), filterPeriod === 'custom' && (_jsxs("div", { className: "exp-filters-custom-range", "aria-label": "\u0421\u0432\u043E\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", children: [_jsx("span", { className: "exp-filters-custom-range__label", children: "\u041F\u0435\u0440\u0438\u043E\u0434:" }), _jsxs("div", { className: "exp-filters-custom-range__field", children: [_jsx("span", { className: "exp-filters-custom-range__field-label", children: "\u0421" }), _jsx(DatePicker, { value: filterDateFrom, max: filterDateTo || undefined, onChange: (iso) => {
                                                            setFilterDateFrom(iso);
                                                            if (filterDateTo && iso > filterDateTo)
                                                                setFilterDateTo(iso);
                                                            setFilterPeriod('custom');
                                                        }, portal: true, buttonClassName: "exp-filters-custom-range__picker" })] }), _jsxs("div", { className: "exp-filters-custom-range__field", children: [_jsx("span", { className: "exp-filters-custom-range__field-label", children: "\u041F\u043E" }), _jsx(DatePicker, { value: filterDateTo, min: filterDateFrom || undefined, onChange: (iso) => {
                                                            setFilterDateTo(iso);
                                                            if (filterDateFrom && iso < filterDateFrom)
                                                                setFilterDateFrom(iso);
                                                            setFilterPeriod('custom');
                                                        }, portal: true, buttonClassName: "exp-filters-custom-range__picker" })] })] }))] }), isLoading ? (_jsx(SkeletonTableBody, { rowCount: 10 })) : loadError ? (_jsx(ServiceUnavailable, { message: loadError, onRetry: () => setLoadKey(k => k + 1) })) : (_jsx(_Fragment, { children: filtered.length === 0 ? (_jsx(EmptyState, { hasFilters: hasFilters, onCreate: handleCreate, moderationQueue: isModerationQueue })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "exp-table", role: "region", "aria-label": "\u0421\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u044F\u0432\u043E\u043A \u043D\u0430 \u0440\u0430\u0441\u0445\u043E\u0434", children: _jsxs("div", { className: "exp-table__body", children: [_jsxs("div", { className: "exp-table__row exp-table__row--head", role: "row", children: [_jsx("div", { className: "exp-table__th exp-table__th--num", role: "columnheader", children: "\u2116" }), _jsx("div", { className: "exp-table__th exp-table__th--desc", role: "columnheader", children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), _jsx("div", { className: "exp-table__th exp-table__th--author", role: "columnheader", children: "\u0410\u0432\u0442\u043E\u0440" }), _jsx("div", { className: "exp-table__th exp-table__th--approvedby", role: "columnheader", children: "\u041E\u0434\u043E\u0431\u0440\u0438\u043B" }), _jsx("div", { className: "exp-table__th exp-table__th--expdate", role: "columnheader", children: "\u0414\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430" }), _jsx("div", { className: "exp-table__th exp-table__th--type", role: "columnheader", children: isPartnerScope ? 'Категория' : 'Тип' }), _jsx("div", { className: "exp-table__th exp-table__th--reimb", role: "columnheader", children: "\u0412\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("div", { className: "exp-table__th exp-table__th--status", role: "columnheader", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("div", { className: "exp-table__th exp-table__th--uzs", role: "columnheader", children: "\u0421\u0443\u043C\u043C\u0430, UZS" }), _jsx("div", { className: "exp-table__th exp-table__th--usd exp-table__th--rate", role: "columnheader", children: "\u042D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442, USD" }), _jsx("div", { className: "exp-table__th exp-table__th--action", role: "columnheader", children: _jsx("span", { className: "exp-table__sr-only", children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" }) })] }), filtered.map(r => (_jsx(ExpenseTableRow, { req: r, onOpen: handleOpenReq, canModerate: canModerate, isPaymentConfirmer: isPaymentConfirmer, currentUserId: user?.id ?? null, currentUserRole: user?.role ?? null, moderationBusyId: tableModerationBusyId, onApprove: handleTableApprove, onRejectClick: openTableReject, onReviseClick: openTableRevise, onPay: handleTablePay, onDeleteClick: handleTableDeleteClick, isActionMenuOpen: expenseTableMenuForId === r.id, onToggleActionMenu: () => setExpenseTableMenuForId(prev => prev === r.id ? null : r.id), onCloseActionMenu: () => setExpenseTableMenuForId(null), partnerScope: isPartnerScope, isCurrent: highlightedRequestId === r.id }, r.id)))] }) }), listTotal != null && listTotal > 0 ? (_jsx(Pagination, { className: "exp-cards-pager", page: listPage, totalCount: listTotal, pageSize: EXPENSES_LIST_PAGE_SIZE, onPageChange: setListPage, loading: listFetchPending })) : null] })) }))] })] }), tableOverlayOpen &&
                typeof document !== 'undefined' &&
                createPortal(_jsxs(_Fragment, { children: [tableReject && (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-table-reject-title", onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: "exp-table-reject-title", className: "exp-mod-dialog__title", children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", tableReject.id, ". \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u2014 \u0430\u0432\u0442\u043E\u0440 \u0435\u0451 \u0443\u0432\u0438\u0434\u0438\u0442 \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u0438."] }), _jsx("textarea", { className: "exp-mod-dialog__textarea", rows: 4, placeholder: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", value: tableRejectReason, onChange: e => setTableRejectReason(e.target.value), disabled: tableModBusy }), tableModErr && _jsx("p", { className: "exp-mod-err", role: "alert", children: tableModErr }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: tableModBusy, onClick: () => { setTableReject(null); setTableModErr(null); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger", disabled: tableModBusy, onClick: confirmTableReject, children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" })] })] }) })), tableRevise && (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "exp-table-revise-title", onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: "exp-table-revise-title", className: "exp-mod-dialog__title", children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443" }), _jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", tableRevise.id, ". \u0410\u0432\u0442\u043E\u0440 \u0441\u043C\u043E\u0436\u0435\u0442 \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043D\u043E\u0432\u0430."] }), _jsx("textarea", { className: "exp-mod-dialog__textarea", rows: 4, placeholder: "\u0427\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u044C", value: tableReviseComment, onChange: e => setTableReviseComment(e.target.value), disabled: tableModBusy }), tableModErr && _jsx("p", { className: "exp-mod-err", role: "alert", children: tableModErr }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: tableModBusy, onClick: () => { setTableRevise(null); setTableModErr(null); }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--primary", disabled: tableModBusy, onClick: confirmTableRevise, children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C" })] })] }) })), tableConfirm && (_jsx(ExpenseConfirmDialog, { isOpen: true, title: tableConfirm.kind === 'approve'
                                ? 'Одобрить заявку?'
                                : tableConfirm.kind === 'pay'
                                    ? 'Подтвердить возмещение?'
                                    : 'Удалить заявку?', message: tableConfirm.kind === 'approve' ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "exp-mod-dialog__sub", children: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u0442\u0430\u043D\u0435\u0442 \u00AB\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E\u00BB." }), tableConfirm.req.expenseType !== 'partner_expense' ? (_jsx("p", { className: "exp-mod-dialog__sub", children: isEmployeePersonalFundsPayout(tableConfirm.req)
                                            ? 'После одобрения заявку нужно компенсировать сотруднику на указанную карту. Подтверждение выплаты выполняет назначенный сотрудник, статус станет «Ожидает компенсацию».'
                                            : 'После одобрения заявка уйдёт на оплату (в том числе перечислением). Отметить оплату могут модераторы реестра расходов.' })) : null] })) : tableConfirm.kind === 'pay' ? (_jsx("p", { className: "exp-mod-dialog__sub", children: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u0442\u0430\u043D\u0435\u0442 \u00AB\u0412\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u043E\u00BB. \u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u043D\u0430 \u043A\u0430\u0440\u0442\u0443 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D." })) : (_jsxs("p", { className: "exp-mod-dialog__sub", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 ", tableConfirm.req.id, " \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u0431\u0435\u0437\u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043D\u043E \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u043C\u0438."] })), confirmLabel: tableConfirm.kind === 'approve'
                                ? 'Одобрить'
                                : tableConfirm.kind === 'pay'
                                    ? expensePayActionLabel(tableConfirm.req)
                                    : 'Удалить', confirmVariant: tableConfirm.kind === 'delete' ? 'danger' : 'primary', busy: tableModBusy, onClose: () => {
                                if (!tableModBusy)
                                    setTableConfirm(null);
                            }, onConfirm: runTableConfirm }))] }), document.body), panelMounted && (_jsx(Suspense, { fallback: null, children: _jsx(ExpensesFormPanel, { isOpen: isPanelOpen, onExited: () => {
                        if (!isPanelOpenRef.current)
                            setPanelMounted(false);
                    }, mode: panelMode, editingRequest: editingRequestForPanel, onClose: handleClosePanel, onSaveDraft: handleSaveDraft, onSubmit: handleSubmit, saveDraftPending: panelSavePending, submitPending: panelSubmitPending, onExpenseSnapshotUpdated: r => {
                        panelDataGenRef.current += 1;
                        setEditingReq(r);
                        setRequests(prev => prev.map(x => (x.id === r.id ? r : x)));
                    }, canModerate: canModerate, onExpenseUpdated: handleExpenseUpdated, onExpenseDeleted: handleExpenseDeleted, emailModerationIntent: emailModerationIntent, onEmailModerationIntentConsumed: () => setEmailModerationIntent(null), allowPaymentReceiptUpload: allowPaymentReceiptUpload, onUploadPaymentReceipts: handleUploadPaymentReceipts, receiptUploadPending: receiptUploadPending, currentUserId: user?.id ?? null, currentUserRole: user?.role ?? null, currentUserEmail: user?.email ?? null, currentUserDisplayName: user?.display_name ?? null, formScope: isPartnerScope ? 'partner' : isClientScope ? 'client' : 'company' }) })), canModerate && isReportOpen && !isPartnerScope && !isClientScope && (_jsx(Suspense, { fallback: null, children: _jsx(ExpensesReportModal, { isOpen: true, requests: requestsForUi, onClose: () => setIsReportOpen(false) }) }))] }));
}
export function ExpensesPage(props) {
    return (_jsx(ExpensesPageBoundary, { children: _jsx(ExpensesPageInner, { ...props }) }));
}
