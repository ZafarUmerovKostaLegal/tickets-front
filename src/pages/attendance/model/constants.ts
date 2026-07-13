import { formatDateForInput } from '@shared/lib/formatDate';

export const LEGACY_TYPE_VALUES = ['', 'late', 'overtime'] as const;
export const DAILY_TYPE_VALUES = ['', 'present_on_time', 'late', 'absent'] as const;
export function parseDateInput(s: string): string {
    return s || '';
}
export const defaultFrom = () => formatDateForInput(new Date());
export const defaultTo = () => formatDateForInput(new Date());
