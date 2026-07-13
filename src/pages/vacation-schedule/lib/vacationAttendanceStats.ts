import type { VacationAttendanceMarkerApi } from '@entities/vacation';
import {
    formatVacationLateMinutes,
    vacationAttendanceLateMinutes,
    type VacationAttendanceWorkday,
    type VacationScheduleEmployeeRow,
} from './vacationScheduleModel';

export type VacationAttendanceEmployeeStats = {
    rowId: number;
    label: string;
    lateCount: number;
    absentCount: number;
    lateMinutesTotal: number;
};

export type VacationAttendanceMonthStats = {
    monthIndex: number;
    monthLabel: string;
    late: number;
    absent: number;
};

export type VacationAttendanceTotals = {
    lateCount: number;
    absentCount: number;
    lateMinutesTotal: number;
    employeesAffected: number;
};

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function parseMarkerDateParts(iso: string): { monthIndex: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return null;
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    return { monthIndex: month - 1, day };
}

export function buildVacationAttendanceEmployeeStats(
    _year: number,
    markers: ReadonlyArray<VacationAttendanceMarkerApi>,
    rows: ReadonlyArray<VacationScheduleEmployeeRow>,
    workday: VacationAttendanceWorkday,
): VacationAttendanceEmployeeStats[] {
    const labelByUserId = new Map<number, { rowId: number; label: string }>();
    for (const row of rows) {
        if (row.systemUserId != null)
            labelByUserId.set(row.systemUserId, { rowId: row.id, label: row.label });
    }
    const acc = new Map<number, VacationAttendanceEmployeeStats>();
    for (const marker of markers) {
        const parsed = parseMarkerDateParts(marker.date);
        if (!parsed)
            continue;
        const link = labelByUserId.get(marker.app_user_id);
        if (!link)
            continue;
        let stat = acc.get(link.rowId);
        if (!stat) {
            stat = {
                rowId: link.rowId,
                label: link.label,
                lateCount: 0,
                absentCount: 0,
                lateMinutesTotal: 0,
            };
            acc.set(link.rowId, stat);
        }
        if (marker.status === 'late') {
            stat.lateCount += 1;
            stat.lateMinutesTotal += vacationAttendanceLateMinutes(marker.first_event_time, workday) ?? 0;
        }
        else {
            stat.absentCount += 1;
        }
    }
    return [...acc.values()].sort((a, b) => {
        const scoreA = a.lateCount * 3 + a.absentCount * 5 + a.lateMinutesTotal / 30;
        const scoreB = b.lateCount * 3 + b.absentCount * 5 + b.lateMinutesTotal / 30;
        if (scoreB !== scoreA)
            return scoreB - scoreA;
        return a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' });
    });
}

export function buildVacationAttendanceMonthStats(
    _year: number,
    markers: ReadonlyArray<VacationAttendanceMarkerApi>,
): VacationAttendanceMonthStats[] {
    const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({
        monthIndex,
        monthLabel: MONTH_LABELS[monthIndex]!,
        late: 0,
        absent: 0,
    }));
    for (const marker of markers) {
        const parsed = parseMarkerDateParts(marker.date);
        if (!parsed)
            continue;
        const bucket = buckets[parsed.monthIndex];
        if (!bucket)
            continue;
        if (marker.status === 'late')
            bucket.late += 1;
        else
            bucket.absent += 1;
    }
    return buckets;
}

export function summarizeVacationAttendanceStats(rows: ReadonlyArray<VacationAttendanceEmployeeStats>): VacationAttendanceTotals {
    let lateCount = 0;
    let absentCount = 0;
    let lateMinutesTotal = 0;
    for (const row of rows) {
        lateCount += row.lateCount;
        absentCount += row.absentCount;
        lateMinutesTotal += row.lateMinutesTotal;
    }
    return {
        lateCount,
        absentCount,
        lateMinutesTotal,
        employeesAffected: rows.length,
    };
}

export function formatVacationLateMinutesTotal(minutes: number): string {
    if (minutes <= 0)
        return '0м';
    return formatVacationLateMinutes(minutes);
}

export function averageVacationLateMinutes(row: VacationAttendanceEmployeeStats): number {
    if (row.lateCount <= 0)
        return 0;
    return Math.round(row.lateMinutesTotal / row.lateCount);
}

const MONTH_NAMES_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatVacationAttendanceStatsPeriod(year: number, referenceDate = new Date()): string {
    const refYear = referenceDate.getFullYear();
    if (year < refYear)
        return `Январь — декабрь ${year}`;
    if (year > refYear)
        return `Год ${year}`;
    const monthIdx = referenceDate.getMonth();
    if (monthIdx === 0)
        return `Январь ${year}`;
    return `Январь — ${MONTH_NAMES_GENITIVE[monthIdx]} ${year}`;
}
