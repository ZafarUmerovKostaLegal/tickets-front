import { routes } from '@shared/config';
import type { TimeTabId } from '@entities/time-tracking/model/types';
import type { TranslationKey } from '@shared/i18n/translate';

const TIME_TAB_IDS = new Set<TimeTabId>([
    'timesheet',
    'expenses',
    'reports',
    'statistics',
    'invoices',
    'clients',
    'projects',
    'users',
    'settings',
]);

let currentSectionTitle = '';
let currentBrandSubtitle = 'Kosta Legal';
let timerTitleOverrideActive = false;

function normalizePath(pathname: string): string {
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed || '/';
}

export function formatWindowTitle(sectionTitle: string, brandSubtitle: string): string {
    const section = sectionTitle.trim();
    if (!section)
        return brandSubtitle.trim();
    return `${section} · ${brandSubtitle.trim()}`;
}

export function resolvePageTitleSection(pathname: string, search: string, t: (key: TranslationKey) => string): string {
    const path = normalizePath(pathname);
    const brandFallback = t('brand.title');

    if (path === routes.login || path === '/')
        return t('pageTitle.login');
    if (path === routes.authCallback)
        return t('pageTitle.authCallback');
    if (path === routes.home)
        return t('nav.home');

    if (path === routes.timeTracking) {
        const tab = new URLSearchParams(search).get('tab');
        if (tab && TIME_TAB_IDS.has(tab as TimeTabId))
            return t(`timeTrackingPage.tabs.${tab as TimeTabId}`);
        return t('nav.timeTracking');
    }

    if (path.startsWith('/time-tracking/project/'))
        return t('pageTitle.project');
    if (path === routes.timeTrackingNewProject)
        return t('pageTitle.newProject');
    if (path.startsWith('/time-tracking/reports/preview'))
        return t('pageTitle.reportPreview');
    if (path.startsWith('/time-tracking/invoices/preview'))
        return t('pageTitle.invoicePreview');
    if (path === routes.timeTrackingInvoiceCreate)
        return t('pageTitle.invoiceCreate');
    if (path.startsWith('/time-tracking/invoices/'))
        return t('pageTitle.invoiceDetail');

    if (path.startsWith('/ticket/'))
        return t('pageTitle.ticket');
    if (path.startsWith('/admin/user/'))
        return t('pageTitle.user');
    if (path === routes.expensesRequests)
        return t('pageTitle.expensesRequests');
    if (path === routes.expensesReport)
        return t('pageTitle.expensesReport');
    if (path === routes.expensesPartnersReport)
        return t('pageTitle.expensesPartnersReport');
    if (path === routes.expensesPartners)
        return t('pageTitle.expensesPartners');

    const routeTitleByPath: Record<string, TranslationKey> = {
        [routes.tickets]: 'nav.tickets',
        [routes.attendance]: 'nav.attendance',
        [routes.vacationSchedule]: 'nav.vacationSchedule',
        [routes.inventory]: 'nav.inventory',
        [routes.todo]: 'nav.todo',
        [routes.expenses]: 'nav.expenses',
        [routes.expensesPartners]: 'nav.expensesPartners',
        [routes.rules]: 'nav.rules',
        [routes.help]: 'nav.help',
        [routes.callSchedule]: 'nav.callSchedule',
        [routes.correspondence]: 'nav.correspondence',
        [routes.accounting]: 'nav.accounting',
        [routes.kostaLegalAi]: 'nav.kostaLegalAi',
        [routes.kostaDaily]: 'nav.kostaDaily',
        [routes.contacts]: 'nav.contacts',
        [routes.internalCommunication]: 'nav.internalCommunication',
        [routes.admin]: 'nav.admin',
        [routes.networkDriveAccess]: 'nav.networkDrive',
    };

    if (routeTitleByPath[path])
        return t(routeTitleByPath[path]);

    if (path.startsWith('/expenses/partners'))
        return t('nav.expensesPartners');
    if (path.startsWith('/expenses/'))
        return t('nav.expenses');

    return brandFallback;
}

export function applyPageTitle(sectionTitle: string, brandSubtitle: string): void {
    currentSectionTitle = sectionTitle;
    currentBrandSubtitle = brandSubtitle;
    if (typeof document === 'undefined' || timerTitleOverrideActive)
        return;
    document.title = formatWindowTitle(sectionTitle, brandSubtitle);
}

export function getBasePageTitle(): string {
    return formatWindowTitle(currentSectionTitle, currentBrandSubtitle);
}

export function setTimerTitleOverride(active: boolean, title?: string): void {
    timerTitleOverrideActive = active;
    if (typeof document === 'undefined')
        return;
    if (active && title)
        document.title = title;
    else if (!active)
        document.title = getBasePageTitle();
}

export function isTimerTitleOverrideActive(): boolean {
    return timerTitleOverrideActive;
}
