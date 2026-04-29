import { useState, useCallback, useMemo, useEffect } from 'react';
import { fetchAttendance, fetchDailyAttendanceReport, type AttendanceRecord, type DailyAttendanceItem, type DailyAttendanceResponse, } from '@entities/attendance';
import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
import { DAILY_TYPE_OPTIONS, LEGACY_TYPE_OPTIONS, parseDateInput } from '../constants';
import { timeToMinutes } from '../lib/timeToMinutes';
import { groupRecords } from '../lib/groupRecords';
import type { AttendanceSummary, GroupedRow } from '../types';
function mapDailyItemToRow(item: DailyAttendanceItem, day: string): GroupedRow {
    const cp = item.camera_name || item.camera_employee_no || '—';
    return {
        key: `daily-${item.app_user_id}-${day}`,
        date: day,
        name: item.display_name,
        department: item.role || '—',
        firstTime: item.first_event_time,
        lastTime: null,
        firstCheckpoint: cp,
        lastCheckpoint: cp,
        status: item.status,
        email: item.email,
        appUserId: item.app_user_id,
        cameraEmployeeNo: item.camera_employee_no,
        explanationText: item.explanation_text ?? null,
        explanationFileUrl: item.explanation_file_url ?? null,
        explanationUpdatedAt: item.explanation_updated_at ?? null,
    };
}
function isLateRow(row: GroupedRow, settings: WorkdaySettings): boolean {
    if (!row.firstTime)
        return false;
    const d = new Date(row.firstTime);
    const [sh, sm] = settings.startTime.split(':').map(Number);
    const threshold = (sh || 0) * 60 + (sm || 0) + settings.lateMinutes;
    const arrived = d.getHours() * 60 + d.getMinutes();
    return arrived > threshold;
}


function attendanceRank(row: GroupedRow, settings: WorkdaySettings): number {
    if (row.status === 'late')
        return 0;
    if (row.status === 'present_on_time')
        return 1;
    if (row.status === 'absent')
        return 2;
    if (!row.firstTime)
        return 2;
    if (isLateRow(row, settings))
        return 0;
    return 1;
}

function compareAttendanceRows(a: GroupedRow, b: GroupedRow, settings: WorkdaySettings): number {
    const d = attendanceRank(a, settings) - attendanceRank(b, settings);
    if (d !== 0)
        return d;
    return (a.name || '').localeCompare(b.name || '', 'ru');
}
export function useAttendanceData(dateFrom: string, dateTo: string, search: string, typeFilter: string, settings: WorkdaySettings) {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [dailyReport, setDailyReport] = useState<DailyAttendanceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const singleDay = useMemo(() => {
        const from = parseDateInput(dateFrom);
        const to = parseDateInput(dateTo);
        return from && to && from === to ? from : null;
    }, [dateFrom, dateTo]);
    const typeFilterOptions = singleDay ? DAILY_TYPE_OPTIONS : LEGACY_TYPE_OPTIONS;
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (singleDay) {
                const res = await fetchDailyAttendanceReport(singleDay);
                setDailyReport(res);
                setRecords([]);
            }
            else {
                const from = parseDateInput(dateFrom) || new Date().toISOString().slice(0, 10);
                const to = parseDateInput(dateTo) || undefined;
                const res = await fetchAttendance({
                    dateFrom: from,
                    dateTo: to,
                    name: search || undefined,
                    maxRecordsPerDevice: 500,
                });
                setRecords(res);
                setDailyReport(null);
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки');
            setRecords([]);
            setDailyReport(null);
        }
        finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, singleDay, search]);
    useEffect(() => {
        load();
    }, [load]);
    const groupedRecords = useMemo((): GroupedRow[] => {
        if (singleDay && dailyReport) {
            return dailyReport.items.map((item) => mapDailyItemToRow(item, singleDay));
        }
        return groupRecords(records);
    }, [singleDay, dailyReport, records]);
    const searchFiltered = useMemo(() => {
        if (!singleDay || !dailyReport) {
            return groupedRecords;
        }
        if (!search.trim())
            return groupedRecords;
        const q = search.trim().toLowerCase();
        return groupedRecords.filter((r) => {
            const name = (r.name || '').toLowerCase();
            const email = (r.email || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [groupedRecords, search, singleDay, dailyReport]);
    const filteredGroupedRecords = useMemo(() => {
        if (!typeFilter)
            return searchFiltered;
        if (singleDay && dailyReport) {
            return searchFiltered.filter((r) => r.status === typeFilter);
        }
        const startMinutes = timeToMinutes(settings.startTime);
        const lateThreshold = startMinutes + settings.lateMinutes;
        return searchFiltered.filter((row) => {
            if (!row.firstTime || !row.lastTime)
                return false;
            const startDate = new Date(row.firstTime);
            const endDate = new Date(row.lastTime);
            const firstMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const workedHours = Math.max(0, (endDate.getTime() - startDate.getTime()) / 3600000);
            if (typeFilter === 'late')
                return firstMinutes > lateThreshold;
            if (typeFilter === 'overtime')
                return workedHours > settings.dailyHours;
            return true;
        });
    }, [searchFiltered, typeFilter, singleDay, dailyReport, settings]);
    const sortedForDisplay = useMemo(() => {
        return [...filteredGroupedRecords].sort((a, b) => compareAttendanceRows(a, b, settings));
    }, [filteredGroupedRecords, settings]);
    const summary = useMemo((): AttendanceSummary => {
        if (singleDay && dailyReport) {
            const s = dailyReport.summary;
            return {
                entries: s.total_tracked_users,
                lateness: s.late,
                overtime: 0,
                total_hours: 0,
                avg_hours_per_entry: 0,
                dailyMode: true,
                present_on_time: s.present_on_time,
                absent: s.absent,
                unmapped_events: s.unmapped_events,
            };
        }
        let lateness = 0;
        let overtime = 0;
        let totalMinutes = 0;
        const startMinutes = timeToMinutes(settings.startTime);
        const lateThreshold = startMinutes + settings.lateMinutes;
        filteredGroupedRecords.forEach((row) => {
            if (!row.firstTime || !row.lastTime)
                return;
            const s = new Date(row.firstTime);
            const e = new Date(row.lastTime);
            const firstMin = s.getHours() * 60 + s.getMinutes();
            const workedMin = Math.max(0, (e.getTime() - s.getTime()) / 60000);
            totalMinutes += workedMin;
            if (firstMin > lateThreshold)
                lateness++;
            if (workedMin / 60 > settings.dailyHours)
                overtime++;
        });
        const totalHours = totalMinutes / 60;
        const avg = filteredGroupedRecords.length > 0 ? totalHours / filteredGroupedRecords.length : 0;
        return {
            entries: filteredGroupedRecords.length,
            lateness,
            overtime,
            total_hours: totalHours,
            avg_hours_per_entry: avg,
            dailyMode: false,
        };
    }, [singleDay, dailyReport, filteredGroupedRecords, settings]);
    const showTable = !loading && !error && sortedForDisplay.length > 0;
    const isDailyMode = !!singleDay;
    return useMemo(() => ({
        records,
        dailyReport,
        loading,
        error,
        load,
        groupedRecords,
        filteredGroupedRecords: sortedForDisplay,
        summary,
        showTable,
        typeFilterOptions,
        isDailyMode,
    }), [
        records,
        dailyReport,
        loading,
        error,
        load,
        groupedRecords,
        sortedForDisplay,
        summary,
        showTable,
        typeFilterOptions,
        isDailyMode,
    ]);
}
