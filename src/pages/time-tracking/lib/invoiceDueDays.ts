function parseYmd(iso: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
        return null;
    return date;
}

function formatYmd(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function dayDiff(start: Date, end: Date): number {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / 86_400_000);
}

export function invoiceCalendarDayCount(issueIso: string, dueIso: string, includeEnd: boolean): number | null {
    const issue = parseYmd(issueIso);
    const due = parseYmd(dueIso);
    if (!issue || !due)
        return null;
    const diff = dayDiff(issue, due);
    if (diff < 0)
        return null;
    return includeEnd ? diff + 1 : diff;
}

export function invoiceWorkingDayCount(issueIso: string, dueIso: string, includeEnd: boolean): number | null {
    const issue = parseYmd(issueIso);
    const due = parseYmd(dueIso);
    if (!issue || !due)
        return null;
    const diff = dayDiff(issue, due);
    if (diff < 0)
        return null;
    const last = new Date(due);
    if (!includeEnd)
        last.setDate(last.getDate() - 1);
    if (last < issue)
        return 0;
    let count = 0;
    const cursor = new Date(issue);
    while (cursor <= last) {
        const weekday = cursor.getDay();
        if (weekday !== 0 && weekday !== 6)
            count += 1;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

export function dueDateFromCalendarDays(issueIso: string, calendarDays: number, includeEnd: boolean): string | null {
    const issue = parseYmd(issueIso);
    if (!issue || !Number.isFinite(calendarDays) || calendarDays < 0)
        return null;
    if (includeEnd && calendarDays < 1)
        return null;
    const shift = includeEnd ? calendarDays - 1 : calendarDays;
    const due = new Date(issue);
    due.setDate(due.getDate() + shift);
    return formatYmd(due);
}
