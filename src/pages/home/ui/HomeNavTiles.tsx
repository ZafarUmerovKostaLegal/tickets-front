import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { routes } from '@shared/config';
import { formatChatUnreadBadge, useChatUnreadTotal } from '@entities/chat';
import {
    getNavTranslationKey,
    getVisibleAppNavItems,
} from '@widgets/sidebar/model/appNavConfig';
import { usePartnerForReviewBadge } from '@entities/time-tracking/lib/usePartnerForReviewBadge';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { useExpenseAttentionBadge } from '@entities/expenses/model/useExpensePaymentConfirmationBadge';
import { useCorrespondencePartnerAttentionBadge } from '@entities/correspondence';
import { useVacationLeavePendingBadge, formatVacationLeavePendingBadge } from '@entities/vacation';
import { useTodoInvitesBadge } from '@entities/todo';
import { isMeetingRoomAccount } from '@shared/lib/meetingRoomAccounts';
import {
    getHubSectionForTile,
    HUB_SECTIONS,
} from '../model/hubSections';
import {
    loadHubTileOrder,
    mergeHubTileOrder,
    reorderHubTilesInSection,
    saveHubTileOrder,
    type HubTileId,
} from '../lib/hubTileOrder';
import './HomeNavTiles.css';

const DRAG_MIME = 'application/x-hub-tile-id';

type HubNavLinkTile = {
    kind: 'link';
    id: HubTileId;
    to: string;
    icon: ComponentType;
};

type HubNavTile = HubNavLinkTile;

function IconSparkles() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9.5 2.5 11 7l4.5 1.5L11 10l-1.5 4.5L7 10 2.5 8.5 7 7z" />
            <path d="M18 14.5 19 17l3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
            <path d="M16 3l.75 2.25L19 6l-2.25.75L16 9l-.75-2.25L13 6l2.25-.75z" />
        </svg>
    );
}

const KOSTA_LEGAL_AI_TILE: HubNavLinkTile = {
    kind: 'link',
    id: 'kostaLegalAi',
    to: routes.kostaLegalAi,
    icon: IconSparkles,
};

function hubTileLabel(id: HubTileId, t: ReturnType<typeof useI18n>['t']): string {
    if (id === 'kostaLegalAi')
        return t('nav.kostaLegalAi');
    return t(getNavTranslationKey(id));
}

function normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
}

function HubTileContent({
    id,
    icon: Icon,
    badge,
    badgeAriaLabel,
    infoBadge,
    infoBadgeAriaLabel,
}: {
    id: HubTileId;
    icon: ComponentType;
    badge?: string;
    badgeAriaLabel?: string;
    infoBadge?: string;
    infoBadgeAriaLabel?: string;
}) {
    const { t } = useI18n();
    return (
        <>
            <span className="home-nav-tiles__icon" aria-hidden>
                <Icon />
            </span>
            {(badge || infoBadge) ? (
                <span className="home-nav-tiles__badges">
                    {infoBadge ? (
                        <span className="home-nav-tiles__badge home-nav-tiles__badge--info" aria-label={infoBadgeAriaLabel}>
                            {infoBadge}
                        </span>
                    ) : null}
                    {badge ? (
                        <span className="home-nav-tiles__badge" aria-label={badgeAriaLabel}>
                            {badge}
                        </span>
                    ) : null}
                </span>
            ) : null}
            <span className="home-nav-tiles__body">
                <span className="home-nav-tiles__label">{hubTileLabel(id, t)}</span>
                <span className="home-nav-tiles__kicker" aria-hidden>
                    {t('common.goTo')} →
                </span>
            </span>
        </>
    );
}

function IconGrip() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden width="14" height="14">
            <circle cx="9" cy="6" r="1.35" />
            <circle cx="15" cy="6" r="1.35" />
            <circle cx="9" cy="12" r="1.35" />
            <circle cx="15" cy="12" r="1.35" />
            <circle cx="9" cy="18" r="1.35" />
            <circle cx="15" cy="18" r="1.35" />
        </svg>
    );
}

type HomeNavTilesProps = {
    searchQuery?: string;
};

export function HomeNavTiles({ searchQuery = '' }: HomeNavTilesProps) {
    const { t } = useI18n();
    const { user, loading } = useCurrentUser();
    const defaultTiles = useMemo((): HubNavTile[] => {
        const fromNav = getVisibleAppNavItems(user, loading)
            .filter((i) => i.to !== routes.home)
            .map((i): HubNavLinkTile => ({
                kind: 'link',
                id: i.id,
                to: i.to,
                icon: i.icon,
            }));
        if (isMeetingRoomAccount(user))
            return fromNav;
        return [KOSTA_LEGAL_AI_TILE, ...fromNav];
    }, [user, loading]);

    const showKostaDailyTile = useMemo(
        () => defaultTiles.some((tile) => tile.id === 'kostaDaily'),
        [defaultTiles],
    );
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
    const {
        badge: expenseAttentionBadge,
        payCount: expensePayCount,
        moderationCount: expenseModerationCount,
        moderationBadge: expenseModerationBadge,
        isPaymentConfirmer: isExpensePaymentConfirmerUser,
    } = useExpenseAttentionBadge(!loading && showExpensesTile);
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
    const {
        badge: correspondenceBadge,
        count: correspondenceCount,
        outgoingPending: correspondenceOutgoingPending,
    } = useCorrespondencePartnerAttentionBadge(!loading && showCorrespondenceTile);
    const correspondenceBadgeAria = correspondenceCount > 0
        ? t('homeHub.correspondencePendingBadgeAria').replace('{count}', String(correspondenceCount))
        : undefined;
    const showVacationTile = defaultTiles.some((tile) => tile.id === 'vacationSchedule');
    const { counts: vacationCounts } = useVacationLeavePendingBadge(
        !loading && showVacationTile,
    );
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
    const { badge: todoInvitesBadge, count: todoInvitesCount } = useTodoInvitesBadge(
        !loading && showTodoTile,
    );
    const todoInvitesBadgeAria = todoInvitesCount > 0
        ? t('homeHub.todoInvitesBadgeAria').replace('{count}', String(todoInvitesCount))
        : undefined;

    const tileDestinations = useMemo((): Partial<Record<HubTileId, string>> => ({
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
        todoInvitesCount,
        firstUnreadRoomId,
    ]);

    const [orderedTiles, setOrderedTiles] = useState<HubNavTile[]>([]);
    const [draggingId, setDraggingId] = useState<HubTileId | null>(null);
    const [dropTargetId, setDropTargetId] = useState<HubTileId | null>(null);
    const itemRefs = useRef<Map<HubTileId, HTMLLIElement>>(new Map());

    useEffect(() => {
        if (loading)
            return;
        const saved = user?.id ? loadHubTileOrder(user.id) : null;
        setOrderedTiles(mergeHubTileOrder(defaultTiles, saved));
    }, [defaultTiles, user?.id, loading]);

    const persistOrder = useCallback((tiles: HubNavTile[]) => {
        if (user?.id)
            saveHubTileOrder(user.id, tiles.map((x) => x.id));
    }, [user?.id]);

    const handleDragStart = useCallback((e: React.DragEvent, tileId: HubTileId) => {
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

    const handleDragOver = useCallback((e: React.DragEvent, targetId: HubTileId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetId(targetId);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: HubTileId) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData(DRAG_MIME);
        const dragId = (raw || draggingId) as HubTileId;
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
            const next = nextIds.map((id) => byId.get(id)!).filter(Boolean);
            persistOrder(next);
            return next;
        });
        handleDragEnd();
    }, [draggingId, handleDragEnd, persistOrder]);

    const query = normalizeSearch(searchQuery);

    const sectionedTiles = useMemo(() => {
        const sectionTileIds = new Map(
            HUB_SECTIONS.map((section) => [section.id, new Set(section.tileIds)]),
        );
        return HUB_SECTIONS.map((section) => {
            const allowedIds = sectionTileIds.get(section.id)!;
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

    return (
        <div className="home-nav-tiles home-nav-tiles--hub" aria-label={t('nav.sectionsAria')}>
            {!query ? (
                <p className="home-nav-tiles__reorder-hint">{t('homeHub.reorderHint')}</p>
            ) : sectionedTiles.length === 0 ? (
                <p className="home-nav-tiles__empty">{t('homeHub.searchEmpty')}</p>
            ) : null}

            {sectionedTiles.map(({ section, tiles }) => (
                <section
                    key={section.id}
                    className="home-nav-tiles__section-block"
                    style={{
                        '--hub-section-accent': section.accent,
                        '--hub-section-soft': section.accentSoft,
                        '--hub-section-border': section.accentBorder,
                    } as CSSProperties}
                    aria-labelledby={`hub-section-${section.id}`}
                >
                    <div className="home-nav-tiles__section-head">
                        <h2 id={`hub-section-${section.id}`} className="home-nav-tiles__section-title">
                            <span className="home-nav-tiles__section-dot" aria-hidden />
                            {t(`homeHub.sections.${section.id}`)}
                        </h2>
                        <span className="home-nav-tiles__section-count" aria-hidden>
                            {String(tiles.length).padStart(2, '0')}
                        </span>
                    </div>

                    <ul className="home-nav-tiles__grid" role="list">
                        {tiles.map((tile) => {
                            const index = tileIndex++;
                            const isDragging = draggingId === tile.id;
                            const isDropTarget = dropTargetId === tile.id && draggingId != null && draggingId !== tile.id;
                            return (
                                <li
                                    key={tile.to}
                                    ref={(node) => {
                                        if (node)
                                            itemRefs.current.set(tile.id, node);
                                        else
                                            itemRefs.current.delete(tile.id);
                                    }}
                                    className={[
                                        'home-nav-tiles__item',
                                        isDragging && 'home-nav-tiles__item--dragging',
                                        isDropTarget && 'home-nav-tiles__item--drop-target',
                                    ].filter(Boolean).join(' ')}
                                    role="listitem"
                                    data-nav-id={tile.id}
                                    data-section={section.id}
                                    style={{ '--hn-tile-i': index } as CSSProperties}
                                    onDragOver={(e) => handleDragOver(e, tile.id)}
                                    onDragEnter={(e) => handleDragOver(e, tile.id)}
                                    onDrop={(e) => handleDrop(e, tile.id)}
                                >
                                    {!query ? (
                                        <button
                                            type="button"
                                            className="home-nav-tiles__drag-handle"
                                            draggable
                                            aria-label={`${t('homeHub.dragTileAria')}: ${hubTileLabel(tile.id, t)}`}
                                            onDragStart={(e) => handleDragStart(e, tile.id)}
                                            onDragEnd={handleDragEnd}
                                            onClick={(e) => e.preventDefault()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <IconGrip />
                                        </button>
                                    ) : null}
                                    <NavLink
                                        to={tileDestinations[tile.id] ?? tile.to}
                                        className={({ isActive }) => `home-nav-tiles__link${isActive ? ' active' : ''}`}
                                        end={tile.id !== 'vacationSchedule' && tile.id !== 'expenses'}
                                        draggable={false}
                                    >
                                        <HubTileContent
                                            id={tile.id}
                                            icon={tile.icon}
                                            badge={
                                                tile.id === 'kostaDaily'
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
                                                                        : undefined
                                            }
                                            badgeAriaLabel={
                                                tile.id === 'kostaDaily'
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
                                                                        : undefined
                                            }
                                            infoBadge={tile.id === 'expenses' ? expenseInfoBadge : undefined}
                                            infoBadgeAriaLabel={tile.id === 'expenses' ? expenseInfoBadgeAria : undefined}
                                        />
                                    </NavLink>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
