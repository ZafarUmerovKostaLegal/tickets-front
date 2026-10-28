import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { routes } from '@shared/config';
import { AnimatedNavLink } from '@shared/ui';
import { formatChatUnreadBadge, useChatUnreadTotal } from '@entities/chat';
import { getNavTranslationKey, getVisibleAppNavItems, } from '@widgets/sidebar/model/appNavConfig';
import { usePartnerForReviewBadge } from '@entities/time-tracking/lib/usePartnerForReviewBadge';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { useExpenseAttentionBadge } from '@entities/expenses/model/useExpensePaymentConfirmationBadge';
import { useCorrespondencePartnerAttentionBadge } from '@entities/correspondence';
import { useVacationLeavePendingBadge, formatVacationLeavePendingBadge } from '@entities/vacation';
import { useTodoInvitesBadge } from '@entities/todo';
import { isMeetingRoomAccount } from '@shared/lib/meetingRoomAccounts';
import { getHubSectionForTile, HUB_SECTIONS, } from '../model/hubSections';
import { loadHubTileOrder, mergeHubTileOrder, reorderHubTilesInSection, saveHubTileOrder, } from '../lib/hubTileOrder';
import './HomeNavTiles.css';
const DRAG_MIME = 'application/x-hub-tile-id';
function IconSparkles() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M9.5 2.5 11 7l4.5 1.5L11 10l-1.5 4.5L7 10 2.5 8.5 7 7z" }), _jsx("path", { d: "M18 14.5 19 17l3 1-3 1-1 3-1-3-3-1 3-1 1-3z" }), _jsx("path", { d: "M16 3l.75 2.25L19 6l-2.25.75L16 9l-.75-2.25L13 6l2.25-.75z" })] }));
}
const KOSTA_LEGAL_AI_TILE = {
    kind: 'link',
    id: 'kostaLegalAi',
    to: routes.kostaLegalAi,
    icon: IconSparkles,
};
function hubTileLabel(id, t) {
    if (id === 'kostaLegalAi')
        return t('nav.kostaLegalAi');
    return t(getNavTranslationKey(id));
}
function normalizeSearch(value) {
    return value.trim().toLowerCase();
}
function HubTileContent({ id, icon: Icon, badge, badgeAriaLabel, infoBadge, infoBadgeAriaLabel, }) {
    const { t } = useI18n();
    return (_jsxs(_Fragment, { children: [_jsx("span", { className: "home-nav-tiles__icon", "aria-hidden": true, children: _jsx(Icon, {}) }), (badge || infoBadge) ? (_jsxs("span", { className: "home-nav-tiles__badges", children: [infoBadge ? (_jsx("span", { className: "home-nav-tiles__badge home-nav-tiles__badge--info", "aria-label": infoBadgeAriaLabel, children: infoBadge })) : null, badge ? (_jsx("span", { className: "home-nav-tiles__badge", "aria-label": badgeAriaLabel, children: badge })) : null] })) : null, _jsxs("span", { className: "home-nav-tiles__body", children: [_jsx("span", { className: "home-nav-tiles__label", children: hubTileLabel(id, t) }), _jsxs("span", { className: "home-nav-tiles__kicker", "aria-hidden": true, children: [t('common.goTo'), " \u2192"] })] })] }));
}
function IconGrip() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, width: "14", height: "14", children: [_jsx("circle", { cx: "9", cy: "6", r: "1.35" }), _jsx("circle", { cx: "15", cy: "6", r: "1.35" }), _jsx("circle", { cx: "9", cy: "12", r: "1.35" }), _jsx("circle", { cx: "15", cy: "12", r: "1.35" }), _jsx("circle", { cx: "9", cy: "18", r: "1.35" }), _jsx("circle", { cx: "15", cy: "18", r: "1.35" })] }));
}
export function HomeNavTiles({ searchQuery = '' }) {
    const { t } = useI18n();
    const { user, loading } = useCurrentUser();
    const defaultTiles = useMemo(() => {
        const fromNav = getVisibleAppNavItems(user, loading)
            .filter((i) => i.to !== routes.home)
            .map((i) => ({
            kind: 'link',
            id: i.id,
            to: i.to,
            icon: i.icon,
        }));
        if (isMeetingRoomAccount(user))
            return fromNav;
        return [KOSTA_LEGAL_AI_TILE, ...fromNav];
    }, [user, loading]);
    const showKostaDailyTile = useMemo(() => defaultTiles.some((tile) => tile.id === 'kostaDaily'), [defaultTiles]);
    const { count: chatUnreadTotal, firstUnreadRoomId } = useChatUnreadTotal(!loading && showKostaDailyTile);
    const chatUnreadBadge = formatChatUnreadBadge(chatUnreadTotal);
    const chatUnreadAria = chatUnreadTotal > 0
        ? t('homeHub.unreadMessagesAria').replace('{count}', String(chatUnreadTotal))
        : undefined;
    const trackForReviewBadge = !loading && canAccessTimeTracking(user);
    const { badge: forReviewBadge, count: forReviewCount } = usePartnerForReviewBadge(trackForReviewBadge);
    const forReviewBadgeAria = forReviewCount > 0
        ? t('homeHub.forReviewPendingBadgeAria').replace('{count}', String(forReviewCount))
        : undefined;
    const showExpensesTile = defaultTiles.some((tile) => tile.id === 'expenses');
    const { badge: expenseAttentionBadge, payCount: expensePayCount, moderationCount: expenseModerationCount, moderationBadge: expenseModerationBadge, isPaymentConfirmer: isExpensePaymentConfirmerUser, } = useExpenseAttentionBadge(!loading && showExpensesTile);
    const expensePayBadge = isExpensePaymentConfirmerUser
        ? (expensePayCount > 0 ? expenseAttentionBadge : undefined)
        : expenseAttentionBadge || undefined;
    const expenseInfoBadge = isExpensePaymentConfirmerUser && expenseModerationCount > 0
        ? expenseModerationBadge || undefined
        : undefined;
    const expenseBadgeAria = isExpensePaymentConfirmerUser && expensePayCount > 0
        ? t('homeHub.expensesPayBadgeAria').replace('{count}', String(expensePayCount))
        : !isExpensePaymentConfirmerUser && expenseModerationCount > 0
            ? t('homeHub.expensesModerationBadgeAria').replace('{count}', String(expenseModerationCount))
            : undefined;
    const expenseInfoBadgeAria = expenseInfoBadge
        ? t('homeHub.expensesModerationBadgeAria').replace('{count}', String(expenseModerationCount))
        : undefined;
    const showCorrespondenceTile = defaultTiles.some((tile) => tile.id === 'correspondence');
    const { badge: correspondenceBadge, count: correspondenceCount, outgoingPending: correspondenceOutgoingPending, incomingNew: correspondenceIncomingNew, } = useCorrespondencePartnerAttentionBadge(!loading && showCorrespondenceTile);
    const correspondenceBadgeAria = correspondenceCount > 0
        ? t('homeHub.correspondencePendingBadgeAria').replace('{count}', String(correspondenceCount))
        : undefined;
    const showVacationTile = defaultTiles.some((tile) => tile.id === 'vacationSchedule');
    const { counts: vacationCounts } = useVacationLeavePendingBadge(!loading && showVacationTile);
    const vacationDisplayBadge = vacationCounts.toDecideCount > 0
        ? formatVacationLeavePendingBadge(vacationCounts.toDecideCount)
        : vacationCounts.minePendingCount > 0
            ? formatVacationLeavePendingBadge(vacationCounts.minePendingCount)
            : '';
    const vacationBadgeAria = vacationCounts.toDecideCount > 0
        ? t('homeHub.vacationToDecideBadgeAria').replace('{count}', String(vacationCounts.toDecideCount))
        : vacationCounts.minePendingCount > 0
            ? t('homeHub.vacationMinePendingBadgeAria').replace('{count}', String(vacationCounts.minePendingCount))
            : undefined;
    const showTodoTile = defaultTiles.some((tile) => tile.id === 'todo');
    const { badge: todoInvitesBadge, count: todoInvitesCount } = useTodoInvitesBadge(!loading && showTodoTile);
    const todoInvitesBadgeAria = todoInvitesCount > 0
        ? t('homeHub.todoInvitesBadgeAria').replace('{count}', String(todoInvitesCount))
        : undefined;
    const tileDestinations = useMemo(() => ({
        vacationSchedule: vacationCounts.toDecideCount > 0
            ? `${routes.vacationSchedule}?tab=to_decide`
            : vacationCounts.minePendingCount > 0
                ? `${routes.vacationSchedule}?tab=mine`
                : routes.vacationSchedule,
        timeTracking: forReviewCount > 0
            ? `${routes.timeTracking}?tab=reports&reportsSection=for-review`
            : routes.timeTracking,
        expenses: isExpensePaymentConfirmerUser && expensePayCount > 0
            ? `${routes.expenses}?focus=pay`
            : routes.expenses,
        correspondence: correspondenceOutgoingPending > 0
            ? `${routes.correspondence}?tab=outgoing&view=attention`
            : correspondenceIncomingNew > 0
                ? `${routes.correspondence}?tab=incoming&view=attention`
                : routes.correspondence,
        todo: todoInvitesCount > 0
            ? `${routes.todo}?invites=1`
            : routes.todo,
        kostaDaily: firstUnreadRoomId != null
            ? `${routes.kostaDaily}?room=${firstUnreadRoomId}`
            : routes.kostaDaily,
    }), [
        vacationCounts.toDecideCount,
        vacationCounts.minePendingCount,
        forReviewCount,
        expensePayCount,
        isExpensePaymentConfirmerUser,
        correspondenceOutgoingPending,
        correspondenceIncomingNew,
        todoInvitesCount,
        firstUnreadRoomId,
    ]);
    const [orderedTiles, setOrderedTiles] = useState([]);
    const [draggingId, setDraggingId] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null);
    const itemRefs = useRef(new Map());
    useEffect(() => {
        if (loading)
            return;
        const saved = user?.id ? loadHubTileOrder(user.id) : null;
        setOrderedTiles(mergeHubTileOrder(defaultTiles, saved));
    }, [defaultTiles, user?.id, loading]);
    const persistOrder = useCallback((tiles) => {
        if (user?.id)
            saveHubTileOrder(user.id, tiles.map((x) => x.id));
    }, [user?.id]);
    const handleDragStart = useCallback((e, tileId) => {
        setDraggingId(tileId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DRAG_MIME, tileId);
        const el = itemRefs.current.get(tileId);
        if (el) {
            e.dataTransfer.setDragImage(el, el.offsetWidth * 0.5, el.offsetHeight * 0.5);
        }
    }, []);
    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
        setDropTargetId(null);
    }, []);
    const handleDragOver = useCallback((e, targetId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetId(targetId);
    }, []);
    const handleDrop = useCallback((e, targetId) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData(DRAG_MIME);
        const dragId = (raw || draggingId);
        if (!dragId || dragId === targetId) {
            handleDragEnd();
            return;
        }
        const dragSection = getHubSectionForTile(dragId);
        const targetSection = getHubSectionForTile(targetId);
        if (!dragSection || dragSection !== targetSection) {
            handleDragEnd();
            return;
        }
        const sectionDef = HUB_SECTIONS.find((section) => section.id === dragSection);
        if (!sectionDef) {
            handleDragEnd();
            return;
        }
        setOrderedTiles((prev) => {
            const ids = prev.map((x) => x.id);
            const nextIds = reorderHubTilesInSection(ids, sectionDef.tileIds, dragId, targetId);
            const byId = new Map(prev.map((x) => [x.id, x]));
            const next = nextIds.map((id) => byId.get(id)).filter(Boolean);
            persistOrder(next);
            return next;
        });
        handleDragEnd();
    }, [draggingId, handleDragEnd, persistOrder]);
    const query = normalizeSearch(searchQuery);
    const sectionedTiles = useMemo(() => {
        const sectionTileIds = new Map(HUB_SECTIONS.map((section) => [section.id, new Set(section.tileIds)]));
        return HUB_SECTIONS.map((section) => {
            const allowedIds = sectionTileIds.get(section.id);
            const tiles = orderedTiles
                .filter((tile) => allowedIds.has(tile.id))
                .filter((tile) => {
                if (!query)
                    return true;
                return normalizeSearch(hubTileLabel(tile.id, t)).includes(query);
            });
            return { section, tiles };
        }).filter((entry) => entry.tiles.length > 0);
    }, [orderedTiles, query, t]);
    if (orderedTiles.length === 0 && !loading)
        return null;
    let tileIndex = 0;
    return (_jsxs("div", { className: "home-nav-tiles home-nav-tiles--hub", "aria-label": t('nav.sectionsAria'), children: [!query ? (_jsx("p", { className: "home-nav-tiles__reorder-hint", children: t('homeHub.reorderHint') })) : sectionedTiles.length === 0 ? (_jsx("p", { className: "home-nav-tiles__empty", children: t('homeHub.searchEmpty') })) : null, sectionedTiles.map(({ section, tiles }) => (_jsxs("section", { className: "home-nav-tiles__section-block", style: {
                    '--hub-section-accent': section.accent,
                    '--hub-section-soft': section.accentSoft,
                    '--hub-section-border': section.accentBorder,
                }, "aria-labelledby": `hub-section-${section.id}`, children: [_jsxs("div", { className: "home-nav-tiles__section-head", children: [_jsxs("h2", { id: `hub-section-${section.id}`, className: "home-nav-tiles__section-title", children: [_jsx("span", { className: "home-nav-tiles__section-dot", "aria-hidden": true }), t(`homeHub.sections.${section.id}`)] }), _jsx("span", { className: "home-nav-tiles__section-count", "aria-hidden": true, children: String(tiles.length).padStart(2, '0') })] }), _jsx("ul", { className: "home-nav-tiles__grid", role: "list", children: tiles.map((tile) => {
                            const index = tileIndex++;
                            const isDragging = draggingId === tile.id;
                            const isDropTarget = dropTargetId === tile.id && draggingId != null && draggingId !== tile.id;
                            return (_jsxs("li", { ref: (node) => {
                                    if (node)
                                        itemRefs.current.set(tile.id, node);
                                    else
                                        itemRefs.current.delete(tile.id);
                                }, className: [
                                    'home-nav-tiles__item',
                                    isDragging && 'home-nav-tiles__item--dragging',
                                    isDropTarget && 'home-nav-tiles__item--drop-target',
                                ].filter(Boolean).join(' '), role: "listitem", "data-nav-id": tile.id, "data-section": section.id, style: { '--hn-tile-i': index }, onDragOver: (e) => handleDragOver(e, tile.id), onDragEnter: (e) => handleDragOver(e, tile.id), onDrop: (e) => handleDrop(e, tile.id), children: [!query ? (_jsx("button", { type: "button", className: "home-nav-tiles__drag-handle", draggable: true, "aria-label": `${t('homeHub.dragTileAria')}: ${hubTileLabel(tile.id, t)}`, onDragStart: (e) => handleDragStart(e, tile.id), onDragEnd: handleDragEnd, onClick: (e) => e.preventDefault(), onMouseDown: (e) => e.stopPropagation(), children: _jsx(IconGrip, {}) })) : null, _jsx(AnimatedNavLink, { to: tileDestinations[tile.id] ?? tile.to, className: ({ isActive }) => `home-nav-tiles__link${isActive ? ' active' : ''}`, end: tile.id !== 'vacationSchedule' && tile.id !== 'expenses', draggable: false, children: _jsx(HubTileContent, { id: tile.id, icon: tile.icon, badge: tile.id === 'kostaDaily'
                                                ? chatUnreadBadge || undefined
                                                : tile.id === 'timeTracking'
                                                    ? forReviewBadge || undefined
                                                    : tile.id === 'expenses'
                                                        ? expensePayBadge
                                                        : tile.id === 'correspondence'
                                                            ? correspondenceBadge || undefined
                                                            : tile.id === 'vacationSchedule'
                                                                ? vacationDisplayBadge || undefined
                                                                : tile.id === 'todo'
                                                                    ? todoInvitesBadge || undefined
                                                                    : undefined, badgeAriaLabel: tile.id === 'kostaDaily'
                                                ? chatUnreadAria
                                                : tile.id === 'timeTracking'
                                                    ? forReviewBadgeAria
                                                    : tile.id === 'expenses'
                                                        ? expenseBadgeAria
                                                        : tile.id === 'correspondence'
                                                            ? correspondenceBadgeAria
                                                            : tile.id === 'vacationSchedule'
                                                                ? vacationBadgeAria
                                                                : tile.id === 'todo'
                                                                    ? todoInvitesBadgeAria
                                                                    : undefined, infoBadge: tile.id === 'expenses' ? expenseInfoBadge : undefined, infoBadgeAriaLabel: tile.id === 'expenses' ? expenseInfoBadgeAria : undefined }) })] }, tile.to));
                        }) })] }, section.id)))] }));
}
