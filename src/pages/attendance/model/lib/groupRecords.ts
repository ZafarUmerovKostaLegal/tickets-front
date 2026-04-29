import type { AttendanceRecord } from '@entities/attendance';
import type { GroupedRow } from '../types';
export function groupRecords(records: AttendanceRecord[]): GroupedRow[] {
    const byKey = new Map<string, AttendanceRecord[]>();
    records.forEach((r) => {
        const dateKey = r.time ? r.time.slice(0, 10) : '';
        const personKey = r.person_id || r.name || '-';
        const key = `${personKey}|${dateKey}`;
        const arr = byKey.get(key);
        if (arr)
            arr.push(r);
        else
            byKey.set(key, [r]);
    });
    const result: GroupedRow[] = [];
    byKey.forEach((rows, key) => {
        rows.sort((a, b) => {
            if (!a.time || !b.time)
                return 0;
            return new Date(a.time).getTime() - new Date(b.time).getTime();
        });
        const first = rows[0];
        const last = rows[rows.length - 1];
        const date = first.time || last.time || '';
        result.push({
            key,
            date,
            name: first.name || last.name || first.person_id || last.person_id || '—',
            department: first.department || last.department || '—',
            firstTime: first.time,
            lastTime: last.time,
            firstCheckpoint: first.checkpoint || last.checkpoint || '—',
            lastCheckpoint: last.checkpoint || first.checkpoint || '—',
        });
    });
    result.sort((a, b) => {
        const aTime = a.firstTime || a.date;
        const bTime = b.firstTime || b.date;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
    return result;
}
