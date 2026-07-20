import { upsertTimeTrackingUser, getUserProjectAccess, getTimeTrackingUser, listProjectsForExpenses, type TimeManagerProjectRecordsLanguage, type TimeTrackingProjectForExpense, } from '@entities/time-tracking';
import { canManageTimeTrackingOrgUsers } from '@entities/time-tracking/model/timeTrackingAccess';
import { isProjectClosedForTimeEntry, todayYmdUtc } from '@entities/time-tracking/lib/projectTimeEntry';
import type { User } from '@entities/user';
import { getMessages } from '@shared/i18n/messages';
import { createTranslator } from '@shared/i18n/translate';
import type { AppLocale } from '@shared/i18n/types';

export type ProjectOption = {
    id: string;
    name: string;
    client: string;
    color: string;
    clientId: string;
    currency: string;
    recordsLanguage: TimeManagerProjectRecordsLanguage;
    /** Archived / paused / ended — keep for historical display, not for new entries. */
    isClosed?: boolean;
};
function hashToColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 52% 40%)`;
}
function isActiveProjectForTimesheet(p: TimeTrackingProjectForExpense, today: string): boolean {
    return !isProjectClosedForTimeEntry(p, today);
}
function mapProjectRowToOption(p: TimeTrackingProjectForExpense, today: string = todayYmdUtc()): ProjectOption {
    return {
        id: p.id,
        name: p.name,
        client: p.clientName,
        clientId: p.clientId,
        color: hashToColor(p.id),
        currency: (p.currency && String(p.currency).trim()) || 'USD',
        recordsLanguage: p.recordsLanguage ?? 'ENG',
        isClosed: isProjectClosedForTimeEntry(p, today),
    };
}
function tForLocale(locale: AppLocale) {
    return createTranslator(getMessages(locale));
}
export async function loadTimesheetProjectOptions(user: User, locale: AppLocale = 'ru', opts?: {
    includeClosed?: boolean;
}): Promise<{
    items: ProjectOption[];
    error: string | null;
}> {
    const t = tForLocale(locale);
    await upsertTimeTrackingUser(user);
    const access = await getUserProjectAccess(user.id);
    const allowed = new Set(access.projectIds);
    if (allowed.size === 0) {
        return { items: [], error: null };
    }
    const today = todayYmdUtc();
    const includeClosed = Boolean(opts?.includeClosed);
    // Archived/closed projects must stay in the catalog for historical rows;
    // new-entry pickers call without includeClosed and stay active-only.
    const rows = await listProjectsForExpenses(
        includeClosed ? { includeArchived: true } : undefined,
    );
    const items = rows
        .filter((p) => allowed.has(p.id))
        .filter((p) => includeClosed || isActiveProjectForTimesheet(p, today))
        .map((p) => mapProjectRowToOption(p, today));
    if (allowed.size > 0 && items.length === 0) {
        return {
            items: [],
            error: t('timeTrackingPage.errors.projectsAccessMisconfigured'),
        };
    }
    return { items, error: null };
}
function mergeProjectOptions(into: Map<string, ProjectOption>, items: ProjectOption[]): void {
    for (const p of items) {
        if (!into.has(p.id))
            into.set(p.id, p);
    }
}
export async function loadTimesheetProjectCatalogForEntriesView(viewer: User, opts?: {
    subjectUser?: User | null;
}, locale: AppLocale = 'ru'): Promise<{
    items: ProjectOption[];
    error: string | null;
}> {
    // Include closed projects so historical timesheet rows keep project/client titles.
    const subject = opts?.subjectUser;
    if (subject && subject.id !== viewer.id) {
        const byId = new Map<string, ProjectOption>();
        const viewerResult = await loadTimesheetProjectOptionsForMove(viewer, locale);
        mergeProjectOptions(byId, viewerResult.items);
        const subjectResult = await loadTimesheetProjectOptions(subject, locale, { includeClosed: true });
        mergeProjectOptions(byId, subjectResult.items);
        const error = viewerResult.error ?? subjectResult.error;
        return { items: [...byId.values()], error };
    }
    return loadTimesheetProjectOptions(viewer, locale, { includeClosed: true });
}
export async function loadTimesheetProjectOptionsForMove(user: User, locale: AppLocale = 'ru'): Promise<{
    items: ProjectOption[];
    error: string | null;
}> {
    await upsertTimeTrackingUser(user);
    if (canManageTimeTrackingOrgUsers(user)) {
        return loadExpenseJournalProjectOptions(user, locale);
    }
    try {
        const ttUser = await getTimeTrackingUser(user.id);
        if (ttUser.can_transfer_time_without_project_access) {
            return loadExpenseJournalProjectOptions(user, locale);
        }
    }
    catch {
        
    }
    return loadTimesheetProjectOptions(user, locale);
}

export async function loadExpenseJournalProjectOptions(user: User, locale: AppLocale = 'ru'): Promise<{
    items: ProjectOption[];
    error: string | null;
}> {
    const t = tForLocale(locale);
    await upsertTimeTrackingUser(user);
    try {
        const rows = await listProjectsForExpenses();
        const today = todayYmdUtc();
        const items = rows
            .filter((p) => !p.isArchived)
            .filter((p) => isActiveProjectForTimesheet(p, today))
            .map((p) => mapProjectRowToOption(p, today));
        return { items, error: null };
    }
    catch (e) {
        return {
            items: [],
            error: e instanceof Error
                ? e.message
                : t('timeTrackingPage.errors.expenseProjectsLoadFailed'),
        };
    }
}
