import { fromZonedTime } from 'date-fns-tz';


export const WEEKLY_SUBMIT_TZ = 'Asia/Tashkent' as const;


export const WEEKLY_SUBMIT_DOW = 1 as const;
export const WEEKLY_SUBMIT_HOUR = 12 as const;

const WEEKLY_SUBMIT_HOUR_HHMMSS = String(WEEKLY_SUBMIT_HOUR).padStart(2, '0') + ':00:00';


export function saturdayStartOfReportingWeek(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d)
        return ymd;
    const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const py = (t.getUTCDay() + 6) % 7; 
    const back = (py + 2) % 7;
    const satMs = t.getTime() - back * 86400000;
    return new Date(satMs).toISOString().slice(0, 10);
}

function ymdAddCalendarDays(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d)
        return ymd;
    const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    t.setUTCDate(t.getUTCDate() + days);
    return t.toISOString().slice(0, 10);
}


function daysFromSaturdayToSubmit(dow: number): number {
    return ((dow - 6 + 7) % 7) + 7;
}

export function reportingWeekCloseInstantUtc(workDateYmd: string): Date {
    const sat = saturdayStartOfReportingWeek(workDateYmd);
    const closeYmd = ymdAddCalendarDays(sat, daysFromSaturdayToSubmit(WEEKLY_SUBMIT_DOW));
    return fromZonedTime(`${closeYmd} ${WEEKLY_SUBMIT_HOUR_HHMMSS}`, WEEKLY_SUBMIT_TZ);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;


export function isWorkDateInClosedReportingPeriod(workDateYmd: string, now: Date = new Date()): boolean {
    const ymd = workDateYmd.trim().slice(0, 10);
    if (!YMD.test(ymd))
        return false;
    return now.getTime() >= reportingWeekCloseInstantUtc(ymd).getTime();
}


export function localTodayYmdInSubmitTz(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: WEEKLY_SUBMIT_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}


export function isWorkDateInCurrentReportingWeek(workDateYmd: string, now: Date = new Date()): boolean {
    const wd = workDateYmd.trim().slice(0, 10);
    if (!YMD.test(wd))
        return false;
    const today = localTodayYmdInSubmitTz(now);
    return saturdayStartOfReportingWeek(wd) === saturdayStartOfReportingWeek(today);
}


export function reportingWeekBounds(workDateYmd: string): { weekStart: string; weekEnd: string } {
    const weekStart = saturdayStartOfReportingWeek(workDateYmd);
    return { weekStart, weekEnd: ymdAddCalendarDays(weekStart, 6) };
}


export function nextWeeklyCloseAt(now: Date = new Date()): Date {
    const ymd = localTodayYmdInSubmitTz(now);
    const candidate = reportingWeekCloseInstantUtc(ymd);
    if (candidate.getTime() <= now.getTime()) {
        const sat = saturdayStartOfReportingWeek(ymd);
        const nextWeekDate = ymdAddCalendarDays(sat, 7);
        return reportingWeekCloseInstantUtc(nextWeekDate);
    }
    return candidate;
}
