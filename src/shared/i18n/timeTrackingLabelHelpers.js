export function ttInvoiceStatusLabel(status, t) {
    const key = `timeTrackingPage.invoices.status.${status}`;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? status : label;
}
export function ttInvoiceSendActionLabel(status, t) {
    return status === 'draft'
        ? t('timeTrackingPage.invoices.actions.sendToClient')
        : t('timeTrackingPage.invoices.actions.resendToClient');
}
export function ttReportTypeLabel(id, t) {
    return t(`timeTrackingPage.reports.types.${id}`);
}
export function ttReportGroupLabel(id, t) {
    return t(`timeTrackingPage.reports.groups.${id}`);
}
export function ttReportPeriodLabel(id, t) {
    return t(`timeTrackingPage.reports.periods.${id}`);
}
export function ttExpenseStatusLabel(status, t) {
    const key = `timeTrackingPage.expenses.status.${status}`;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? status : label;
}
export function ttExpenseCategoryLabel(category, t) {
    const key = `timeTrackingPage.expenses.categories.${category}`;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? category : label;
}
export function ttProjectStatusLabel(status, t) {
    const key = `timeTrackingPage.projects.status.${status}`;
    const label = t(key);
    return label.startsWith('timeTrackingPage.') ? status : label;
}
export function ttProjectTypeLabel(type, t) {
    const raw = String(type ?? '').trim();
    if (!raw)
        return '';
    const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
    const map = {
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
    const fallbackRu = {
        'Время и материалы': 'Время и материалы',
        'Фиксированная ставка': 'Фиксированный гонорар',
        'Фиксированный гонорар': 'Фиксированный гонорар',
        'Без бюджета': 'Не оплачиваемый',
        'Не оплачиваемый': 'Не оплачиваемый',
        'Пакет часов': 'Пакет часов',
        hourly: 'Время и материалы',
        time_and_materials: 'Время и материалы',
        tm: 'Время и материалы',
        fixed: 'Фиксированный гонорар',
        fixed_fee: 'Фиксированный гонорар',
        flat_fee: 'Фиксированный гонорар',
        capped: 'Пакет часов',
        hour_package: 'Пакет часов',
        non_billable: 'Не оплачиваемый',
        nonbillable: 'Не оплачиваемый',
    };
    const key = map[raw] ?? map[normalized];
    if (!key)
        return raw;
    const label = t(key);
    if (label.startsWith('timeTrackingPage.'))
        return fallbackRu[raw] ?? fallbackRu[normalized] ?? raw;
    return label;
}
export function ttProjectPluralWord(count, t, locale) {
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
export function ttProjectPluralCount(count, t, locale) {
    if (count === 0)
        return t('timeTrackingPage.clients.table.noProjects');
    return `${count} ${ttProjectPluralWord(count, t, locale)}`;
}
