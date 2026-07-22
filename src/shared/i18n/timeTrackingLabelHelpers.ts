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
    const raw = String(type ?? '').trim();
    const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
    const map: Record<string, TranslationKey> = {
        // Canonical UI values (stored on ProjectRow)
        'Время и материалы': 'timeTrackingPage.projects.modal.projectTypes.timeAndMaterials',
        'Фиксированная ставка': 'timeTrackingPage.projects.modal.projectTypes.fixedFee',
        'Фиксированный гонорар': 'timeTrackingPage.projects.modal.projectTypes.fixedFee',
        'Без бюджета': 'timeTrackingPage.projects.modal.projectTypes.nonBillable',
        'Не оплачиваемый': 'timeTrackingPage.projects.modal.projectTypes.nonBillable',
        'Пакет часов': 'timeTrackingPage.projects.modal.projectTypes.hourPackage',
        // API / legacy aliases (hourly / fixed / capped)
        hourly: 'timeTrackingPage.projects.modal.projectTypes.timeAndMaterials',
        time_and_materials: 'timeTrackingPage.projects.modal.projectTypes.timeAndMaterials',
        tm: 'timeTrackingPage.projects.modal.projectTypes.timeAndMaterials',
        fixed: 'timeTrackingPage.projects.modal.projectTypes.fixedFee',
        fixed_fee: 'timeTrackingPage.projects.modal.projectTypes.fixedFee',
        flat_fee: 'timeTrackingPage.projects.modal.projectTypes.fixedFee',
        capped: 'timeTrackingPage.projects.modal.projectTypes.hourPackage',
        hour_package: 'timeTrackingPage.projects.modal.projectTypes.hourPackage',
        non_billable: 'timeTrackingPage.projects.modal.projectTypes.nonBillable',
        nonbillable: 'timeTrackingPage.projects.modal.projectTypes.nonBillable',
    };
    const key = map[raw] ?? map[normalized];
    return key ? t(key) : raw;
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
