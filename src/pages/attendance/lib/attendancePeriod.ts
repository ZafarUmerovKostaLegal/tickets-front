import type { AttendanceStatus, DailyAttendanceItem } from '@entities/attendance';

export type AttendanceDayRow = DailyAttendanceItem & { date: string };

export function parseYmd(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y || 1970, Math.max(0, (m || 1) - 1), d || 1);
}

export function toYmd(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isWeekendYmd(ymd: string): boolean {
    const dow = parseYmd(ymd).getDay();
    return dow === 0 || dow === 6;
}

export function eventMs(iso: string | null | undefined): number | null {
    if (!iso)
        return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
}

export type WorkedTime = {
    ms: number | null;
    ongoing: boolean;
    noExit: boolean;
};

export function workedTime(row: Pick<AttendanceDayRow, 'date' | 'first_event_time' | 'last_event_time'>, now: Date = new Date()): WorkedTime {
    const first = eventMs(row.first_event_time);
    if (first == null)
        return { ms: null, ongoing: false, noExit: false };
    const last = eventMs(row.last_event_time ?? null);
    if (last != null && last > first)
        return { ms: last - first, ongoing: false, noExit: false };
    if (row.date === toYmd(now) && now.getTime() > first)
        return { ms: now.getTime() - first, ongoing: true, noExit: false };
    return { ms: null, ongoing: false, noExit: true };
}

export function formatDuration(ms: number | null): string {
    if (ms == null || !Number.isFinite(ms) || ms < 0)
        return '—';
    const totalMin = Math.floor(ms / 60_000);
    return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`;
}

function minuteOfDay(iso: string | null | undefined): number | null {
    const ms = eventMs(iso);
    if (ms == null)
        return null;
    const d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes();
}

export function formatMinuteOfDay(minutes: number | null): string {
    if (minutes == null || !Number.isFinite(minutes))
        return '—';
    const m = Math.round(minutes);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function relevantPeriodRows<T extends AttendanceDayRow>(rows: T[], today: string): T[] {
    return rows.filter((row) => {
        if (row.date > today)
            return false;
        if (row.status === 'absent' && isWeekendYmd(row.date))
            return false;
        return true;
    });
}

export type EmployeePeriodSummary = {
    key: string;
    name: string;
    subtitle: string;
    appUserId: number | null;
    cameraEmployeeNo: string;
    days: number;
    present: number;
    onTime: number;
    late: number;
    absent: number;
    noExit: number;
    workedMs: number;
    avgArrival: number | null;
    avgDeparture: number | null;
    latestArrival: number | null;
};

export function personKey(row: Pick<DailyAttendanceItem, 'camera_employee_no' | 'app_user_id' | 'display_name' | 'camera_name'>): string {
    const cameraNo = (row.camera_employee_no || '').trim();
    if (cameraNo)
        return `c:${cameraNo}`;
    if (row.app_user_id != null)
        return `u:${row.app_user_id}`;
    return `n:${(row.display_name || row.camera_name || '').trim().toLowerCase()}`;
}

export function summarizeByEmployee(rows: AttendanceDayRow[], now: Date = new Date()): EmployeePeriodSummary[] {
    type Acc = EmployeePeriodSummary & { arrivals: number[]; departures: number[] };
    const byKey = new Map<string, Acc>();
    for (const row of rows) {
        const key = personKey(row);
        let acc = byKey.get(key);
        if (!acc) {
            acc = {
                key,
                name: row.display_name || row.camera_name || '—',
                subtitle: (row.position || row.department || '').trim(),
                appUserId: row.app_user_id,
                cameraEmployeeNo: (row.camera_employee_no || '').trim(),
                days: 0,
                present: 0,
                onTime: 0,
                late: 0,
                absent: 0,
                noExit: 0,
                workedMs: 0,
                avgArrival: null,
                avgDeparture: null,
                latestArrival: null,
                arrivals: [],
                departures: [],
            };
            byKey.set(key, acc);
        }
        acc.days += 1;
        const status: AttendanceStatus = row.status;
        if (status === 'absent') {
            acc.absent += 1;
            continue;
        }
        acc.present += 1;
        if (status === 'late')
            acc.late += 1;
        else
            acc.onTime += 1;
        const arrival = minuteOfDay(row.first_event_time);
        if (arrival != null)
            acc.arrivals.push(arrival);
        const worked = workedTime(row, now);
        if (worked.noExit)
            acc.noExit += 1;
        if (worked.ms != null)
            acc.workedMs += worked.ms;
        if (!worked.ongoing && !worked.noExit) {
            const departure = minuteOfDay(row.last_event_time ?? null);
            if (departure != null)
                acc.departures.push(departure);
        }
    }
    const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
    return [...byKey.values()].map(({ arrivals, departures, ...summary }) => ({
        ...summary,
        avgArrival: avg(arrivals),
        avgDeparture: avg(departures),
        latestArrival: arrivals.length ? Math.max(...arrivals) : null,
    }));
}
