import { fromZonedTime } from 'date-fns-tz';


export const WEEKLY_SUBMIT_TZ = 'Asia/Tashkent' as const;


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


export function reportingWeekCloseInstantUtc(workDateYmd: string): Date {
    const sat = saturdayStartOfReportingWeek(workDateYmd);
    const closeYmd = ymdAddCalendarDays(sat, 7);
    return fromZonedTime(`${closeYmd} 09:00:00`, WEEKLY_SUBMIT_TZ);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;


export function isWorkDateInClosedReportingPeriod(workDateYmd: string, now: Date = new Date()): boolean {
    const ymd = workDateYmd.trim().slice(0, 10);
    if (!YMD.test(ymd))
        return false;
    return now.getTime() >= reportingWeekCloseInstantUtc(ymd).getTime();
}
