import type { TranslationKey } from '@shared/i18n';
import { DAILY_TYPE_VALUES, LEGACY_TYPE_VALUES } from './constants';

type TranslateFn = (key: TranslationKey) => string;

const LEGACY_FILTER_LABELS: Record<(typeof LEGACY_TYPE_VALUES)[number], TranslationKey> = {
    '': 'attendancePage.filter.allRecords',
    late: 'attendancePage.filter.lateOnly',
    overtime: 'attendancePage.filter.overtimeOnly',
};

const DAILY_FILTER_LABELS: Record<(typeof DAILY_TYPE_VALUES)[number], TranslationKey> = {
    '': 'attendancePage.filterAll',
    present_on_time: 'attendancePage.filter.onTime',
    late: 'attendancePage.filter.late',
    absent: 'attendancePage.filter.absent',
};

export function buildTypeFilterOptions(isDailyMode: boolean, t: TranslateFn): {
    value: string;
    label: string;
}[] {
    if (isDailyMode) {
        return DAILY_TYPE_VALUES.map((value) => ({
            value,
            label: t(DAILY_FILTER_LABELS[value]),
        }));
    }
    return LEGACY_TYPE_VALUES.map((value) => ({
        value,
        label: t(LEGACY_FILTER_LABELS[value]),
    }));
}

export function fillAttendanceTemplate(template: string, params: Record<string, string>): string {
    let out = template;
    for (const [key, value] of Object.entries(params))
        out = out.replace(`{${key}}`, value);
    return out;
}
