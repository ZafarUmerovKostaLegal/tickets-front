import type { CSSProperties } from 'react';

export const OUTLOOK_CALENDAR_ALL_ID = '__all__';

const PALETTE = [
    '#4f46e5',
    '#0891b2',
    '#d97706',
    '#059669',
    '#db2777',
    '#7c3aed',
    '#dc2626',
    '#2563eb',
    '#0d9488',
    '#ca8a04',
] as const;

export function buildOutlookCalendarColorOrder(calendarIds: readonly string[]): string[] {
    return [...new Set(calendarIds.filter((id) => id && id.trim()))];
}

export function outlookCalendarAccentColor(calendarId: string, order: readonly string[]): string {
    const idx = order.indexOf(calendarId);
    const i = idx >= 0 ? idx : hashCalendarId(calendarId) % PALETTE.length;
    return PALETTE[i % PALETTE.length]!;
}

function hashCalendarId(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i += 1)
        h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export function outlookCalendarAccentStyle(accent: string): CSSProperties {
    return { '--ev-cal-accent': accent } as CSSProperties;
}
