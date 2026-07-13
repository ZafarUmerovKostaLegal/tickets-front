import { useState, useCallback, useMemo, useEffect } from 'react';
import { fetchAttendance, fetchDailyAttendanceReport, fetchWorkdaySettings, workdayDtoToSettings, type AttendanceRecord, type DailyAttendanceItem, } from '@entities/attendance';
import { DEFAULT_WORKDAY_SETTINGS, type WorkdaySettings } from '@shared/lib/attendanceSettings';
import type { LateMetrics } from '../types';
function normalizePersonName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
export function useAdminAttendance() {
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [dailyLateByEmp, setDailyLateByEmp] = useState<Map<string, DailyAttendanceItem>>(() => new Map());
    const [dailyLateByName, setDailyLateByName] = useState<Map<string, DailyAttendanceItem>>(() => new Map());
    const [lateLoading, setLateLoading] = useState(false);
    const [lateError, setLateError] = useState<string | null>(null);
    const [workdaySettings, setWorkdaySettings] = useState<WorkdaySettings>(DEFAULT_WORKDAY_SETTINGS);
    useEffect(() => {
        let cancelled = false;
        fetchWorkdaySettings()
            .then((dto) => {
            if (!cancelled)
                setWorkdaySettings(workdayDtoToSettings(dto));
        })
            .catch(() => {
            if (!cancelled)
                setWorkdaySettings(DEFAULT_WORKDAY_SETTINGS);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const loadAttendance = useCallback(async () => {
        setLateLoading(true);
        setLateError(null);
        try {
            const today = new Date();
            const date = today.toISOString().slice(0, 10);
            const [records, daily] = await Promise.all([
                fetchAttendance({
                    dateFrom: date,
                    dateTo: date,
                    maxRecordsPerDevice: 500,
                }),
                fetchDailyAttendanceReport(date).catch(() => null),
            ]);
            setAttendance(records);
            const byEmp = new Map<string, DailyAttendanceItem>();
            const byName = new Map<string, DailyAttendanceItem>();
            if (daily?.items) {
                for (const item of daily.items) {
                    if (item.status !== 'late')
                        continue;
                    const no = item.camera_employee_no?.trim();
                    if (no)
                        byEmp.set(no, item);
                    byName.set(normalizePersonName(item.display_name), item);
                }
            }
            setDailyLateByEmp(byEmp);
            setDailyLateByName(byName);
        }
        catch (e) {
            setLateError(e instanceof Error ? e.message : 'Не удалось загрузить посещаемость');
            setAttendance([]);
            setDailyLateByEmp(new Map());
            setDailyLateByName(new Map());
        }
        finally {
            setLateLoading(false);
        }
    }, []);
    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);
    const lateMetrics = useMemo((): LateMetrics => {
        if (attendance.length === 0) {
            return { total: 0, lateCount: 0, onTime: 0, lateEmployees: [] };
        }
        const settings = workdaySettings;
        const timeToMinutes = (time: string): number => {
            const [h, m] = time.split(':').map((v) => Number(v));
            if (!Number.isFinite(h) || !Number.isFinite(m))
                return 0;
            return h * 60 + m;
        };
        const threshold = timeToMinutes(settings.startTime) + settings.lateMinutes;
        const byPerson = new Map<string, {
            name: string;
            department: string;
            firstTime: string;
            personId: string;
        }>();
        attendance.forEach((r) => {
            if (!r.time)
                return;
            const date = r.time.slice(0, 10);
            const key = `${r.person_id || r.name || '-'}|${date}`;
            const existing = byPerson.get(key);
            const pid = (r.person_id || '').trim();
            if (!existing || new Date(r.time).getTime() < new Date(existing.firstTime).getTime()) {
                byPerson.set(key, {
                    name: r.name || r.person_id || '-',
                    department: r.department || '—',
                    firstTime: r.time,
                    personId: pid,
                });
            }
        });
        const rows: LateMetrics['lateEmployees'] = [];
        byPerson.forEach((value) => {
            const timePart = value.firstTime.slice(11, 16);
            const minutes = timeToMinutes(timePart);
            const minutesLate = minutes - threshold;
            let dailyItem: DailyAttendanceItem | undefined;
            if (value.personId && dailyLateByEmp.has(value.personId)) {
                dailyItem = dailyLateByEmp.get(value.personId);
            }
            else {
                dailyItem = dailyLateByName.get(normalizePersonName(value.name));
            }
            rows.push({
                name: value.name,
                department: value.department,
                firstTime: value.firstTime,
                minutesLate: minutesLate > 0 ? minutesLate : 0,
                personId: value.personId || undefined,
                explanationText: dailyItem?.explanation_text ?? null,
                explanationFileUrl: dailyItem?.explanation_file_url ?? null,
            });
        });
        const total = rows.length;
        const lateEmployees = rows.filter((r) => r.minutesLate > 0).sort((a, b) => b.minutesLate - a.minutesLate);
        const lateCount = lateEmployees.length;
        const onTime = total - lateCount;
        return { total, lateCount, onTime, lateEmployees };
    }, [attendance, workdaySettings, dailyLateByEmp, dailyLateByName]);
    return {
        attendance,
        lateLoading,
        lateError,
        lateMetrics,
        loadAttendance,
    };
}
