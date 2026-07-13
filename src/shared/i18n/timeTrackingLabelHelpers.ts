import type { TranslationKey } from './translate';
import type { InvoiceUiStatus } from '@entities/time-tracking/api';
import type { PeriodGranularity, ReportTypeV2, GroupByV2 } from '@entities/time-tracking/model/reportsPanelConfig';

export type TimeTrackingT = (key: TranslationKey) => string;

export function ttInvoiceStatusLabel(status: string, t: TimeTrackingT): string {
    const key = `timeTrackingPage.invoices.status.${status}` as TranslationKey;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? status : label;
}

export function ttInvoiceSendActionLabel(status: InvoiceUiStatus, t: TimeTrackingT): string {
    return status === 'draft'
        ? t('timeTrackingPage.invoices.actions.sendToClient')
        : t('timeTrackingPage.invoices.actions.resendToClient');
}

export function ttReportTypeLabel(id: ReportTypeV2, t: TimeTrackingT): string {
    return t(`timeTrackingPage.reports.types.${id}` as TranslationKey);
}

export function ttReportGroupLabel(id: GroupByV2, t: TimeTrackingT): string {
    return t(`timeTrackingPage.reports.groups.${id}` as TranslationKey);
}

export function ttReportPeriodLabel(id: PeriodGranularity, t: TimeTrackingT): string {
    return t(`timeTrackingPage.reports.periods.${id}` as TranslationKey);
}

export function ttExpenseStatusLabel(status: string, t: TimeTrackingT): string {
    const key = `timeTrackingPage.expenses.status.${status}` as TranslationKey;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? status : label;
}

export function ttExpenseCategoryLabel(category: string, t: TimeTrackingT): string {
    const key = `timeTrackingPage.expenses.categories.${category}` as TranslationKey;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? category : label;
}

export function ttProjectStatusLabel(status: string, t: TimeTrackingT): string {
    const key = `timeTrackingPage.projects.status.${status}` as TranslationKey;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? status : label;
}

export function ttProjectTypeLabel(type: string, t: TimeTrackingT): string {
    const map: Record<string, TranslationKey> = {
        'Время и материалы': 'timeTrackingPage.projects.budgetTypes.timeAndMaterials',
        'Фиксированная ставка': 'timeTrackingPage.projects.budgetTypes.fixedRate',
        'Без бюджета': 'timeTrackingPage.projects.budgetTypes.noBudget',
        'Пакет часов': 'timeTrackingPage.projects.budgetTypes.hourPackage',
    };
    const key = map[type];
    return key ? t(key) : type;
}

export function ttProjectPluralWord(count: number, t: TimeTrackingT, locale: 'ru' | 'en'): string {
    if (count === 0)
        return t('timeTrackingPage.clients.table.noProjects');
    if (locale === 'en')
        return count === 1 ? t('timeTrackingPage.projects.plural.one') : t('timeTrackingPage.projects.plural.many');
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11)
        return t('timeTrackingPage.projects.plural.one');
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
        return t('timeTrackingPage.projects.plural.few');
    return t('timeTrackingPage.projects.plural.many');
}

export function ttProjectPluralCount(count: number, t: TimeTrackingT, locale: 'ru' | 'en'): string {
    if (count === 0)
        return t('timeTrackingPage.clients.table.noProjects');
    return `${count} ${ttProjectPluralWord(count, t, locale)}`;
}
