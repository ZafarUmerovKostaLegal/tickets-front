import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { MOCK_DONE_IDS, TASK_PROJECTS, type HubTask } from './legalHubTasks';

export type LegalHubNavId = 'myTasks' | 'reviewQueue' | 'projects' | 'allTeam';

/** `/legal-hub?view=projects` — sections live in the URL so Back, refresh and shared links work. */
export function legalHubSectionUrl(section: LegalHubNavId): string {
    return section === 'myTasks' ? routes.legalHub : `${routes.legalHub}?view=${section}`;
}

export function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export type DueTone = 'late' | 'today' | 'soon' | 'calm';

export function dueTone(delta: number): DueTone {
    if (delta < 0)
        return 'late';
    if (delta === 0)
        return 'today';
    if (delta <= 2)
        return 'soon';
    return 'calm';
}

export function dueText(delta: number, t: (key: TranslationKey) => string): string {
    if (delta < 0)
        return t('legalHub.taskOverdue').replace('{count}', String(-delta));
    if (delta === 0)
        return t('legalHub.taskToday');
    return t('legalHub.taskDaysLeft').replace('{count}', String(delta));
}

/** Compact relative deadline: «просрочено 2 д», «сегодня», «ещё 3 д». */
export function DueBadge({ iso, prefix, className = '' }: { iso: string; prefix?: string; className?: string }) {
    const { t } = useI18n();
    if (!iso)
        return null;
    const delta = dayDelta(iso);
    const tone = dueTone(delta);
    return (
        <span className={`lh-due lh-due--${tone}${className ? ` ${className}` : ''}`}>
            {tone === 'late' ? <i aria-hidden /> : null}
            {prefix ? `${prefix} ` : ''}
            {dueText(delta, t)}
        </span>
    );
}

export type AttentionReason = 'late' | 'reviewLate' | 'changes' | 'follow' | 'wait';

export const ATTENTION_LABEL: Record<AttentionReason, TranslationKey> = {
    late: 'legalHub.myTasksLate',
    reviewLate: 'legalHub.myTasksReviewLate',
    changes: 'legalHub.statusChanges',
    follow: 'legalHub.myTasksFollowDue',
    wait: 'legalHub.statusWaiting',
};

const ATTENTION_ORDER: AttentionReason[] = ['late', 'changes', 'reviewLate', 'follow', 'wait'];

/** Why a task needs the owner's attention right now, or null when it can wait. */
export function attentionReason(task: HubTask): AttentionReason | null {
    if (dayDelta(task.clientOn) < 0)
        return 'late';
    if (task.status === 'changes')
        return 'changes';
    if (task.reviewOn != null && task.reviewOn !== '' && dayDelta(task.reviewOn) < 0 && (task.status === 'associate' || task.status === 'partner'))
        return 'reviewLate';
    if (task.status === 'wait')
        return task.followUpOn != null && dayDelta(task.followUpOn) <= 0 ? 'follow' : 'wait';
    return null;
}

export function attentionRank(reason: AttentionReason): number {
    return ATTENTION_ORDER.indexOf(reason);
}

export type HubBadges = { attention: number; review: number; risk: number };

export function hubBadges(tasks: HubTask[]): HubBadges {
    const open = tasks.filter((task) => !MOCK_DONE_IDS.includes(task.id));
    return {
        attention: open.filter((task) => attentionReason(task) != null).length,
        review: tasks.filter((task) => task.status === 'associate' || task.status === 'partner' || task.status === 'changes').length,
        risk: TASK_PROJECTS.filter((id) => tasks.some((task) => task.project === id && dayDelta(task.clientOn) < 0)).length,
    };
}

/**
 * The page header owns a slot on the right for the current section's primary action
 * ("Новая задача", "Временный сотрудник"). Sections render into it with <HeadActions>.
 */
export const HeadActionsContext = createContext<HTMLElement | null>(null);

export function HeadActions({ children }: { children: ReactNode }) {
    const slot = useContext(HeadActionsContext);
    if (slot == null)
        return null;
    return createPortal(children, slot);
}
