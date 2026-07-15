import type { TranslationKey } from '@shared/i18n';
import { formatHoursClockFromDecimalHours } from '@shared/lib/formatTrackingHours';

export function startOfWeek(d: Date): Date {
    const day = new Date(d);
    const dow = day.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
}
export function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
export function startOfMonth(d: Date): Date {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
export function endOfMonth(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    x.setHours(0, 0, 0, 0);
    return x;
}
export function addMonths(d: Date, n: number): Date {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
}
export function isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export function weekdayLabels(t: (key: TranslationKey) => string): string[] {
    return WEEKDAY_KEYS.map((k) => t(`timeTrackingPage.weekdays.${k}`));
}
export type TimesheetViewMode = 'day' | 'week' | 'calendar';
export type ViewTxPhase = 'idle' | 'hiding' | 'skel' | 'showing';
export const VIEW_TX_HIDE_MS = 100;
export const VIEW_TX_SKEL_MS = 200;
export const VIEW_TX_SHOW_MS = 260;
const TIMESHEET_VIEW_MODE_STORAGE_KEY = 'tt-timesheet-view-mode-v1';
export function readStoredTimesheetViewMode(): TimesheetViewMode | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(TIMESHEET_VIEW_MODE_STORAGE_KEY)?.trim();
        if (raw === 'day' || raw === 'week' || raw === 'calendar')
            return raw;
    }
    catch {
    }
    return null;
}
export function writeStoredTimesheetViewMode(mode: TimesheetViewMode): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(TIMESHEET_VIEW_MODE_STORAGE_KEY, mode);
    }
    catch {
    }
}
export type WeekDayOrder = 'monday' | 'today';
const TIMESHEET_WEEK_DAY_ORDER_STORAGE_KEY = 'tt-timesheet-week-day-order-v1';
export function readStoredWeekDayOrder(): WeekDayOrder {
    if (typeof window === 'undefined')
        return 'monday';
    try {
        const raw = window.localStorage.getItem(TIMESHEET_WEEK_DAY_ORDER_STORAGE_KEY)?.trim();
        if (raw === 'today')
            return 'today';
    }
    catch {
    }
    return 'monday';
}
export function writeStoredWeekDayOrder(order: WeekDayOrder): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(TIMESHEET_WEEK_DAY_ORDER_STORAGE_KEY, order);
    }
    catch {
    }
}
export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
export function reorderWeekDaysFromToday(days: Date[], weekStart: Date, today: Date): Date[] {
    if (!isSameDay(weekStart, startOfWeek(today)))
        return days;
    const idx = days.findIndex((d) => isSameDay(d, today));
    if (idx <= 0)
        return days;
    return [...days.slice(idx), ...days.slice(0, idx)];
}
export function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
export function getTodayDate(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export const TIMESHEET_CALENDAR_MAX_MONTHS_AHEAD = 12;
export function isFutureCalendarDay(d: Date, today: Date): boolean {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return day.getTime() > today.getTime();
}
export function parseYmd(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map((n) => Number(n));
    return new Date(y, m - 1, d);
}
export function isFutureWorkDateYmd(ymd: string, today: Date): boolean {
    const trimmed = ymd.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return false;
    return isFutureCalendarDay(parseYmd(trimmed), today);
}
export function fmtShort(d: Date, dateTag: string) {
    return d.toLocaleDateString(dateTag, { weekday: 'short' }).replace('.', '').toUpperCase();
}
export function fmtHours(h: number): string {
    return formatHoursClockFromDecimalHours(h);
}
export function fmtDateHeading(d: Date, dateTag: string): string {
    return d.toLocaleDateString(dateTag, { weekday: 'long', day: 'numeric', month: 'long' })
        .replace(/^\w/, c => c.toUpperCase());
}
