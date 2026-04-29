import type { VacationAbsenceKind, VacationMarksState } from './vacationScheduleModel';
import { parseVacationCellKey, VACATION_ABSENCE_KINDS } from './vacationScheduleModel';
export type VacationPayrollParams = {
    avgMonthlySalary: number;
    avgCalendarDaysPerMonth: number;
    sickLeavePayRate: number;
    vacationPayRate: number;
};
export const DEFAULT_VACATION_PAYROLL_PARAMS: VacationPayrollParams = {
    avgMonthlySalary: 0,
    avgCalendarDaysPerMonth: 29.3,
    sickLeavePayRate: 0.6,
    vacationPayRate: 1,
};
const PAYROLL_LS_KEY = 'kl-vacation-payroll-params-v1';
type PayrollLsBox = {
    year: number;
    avgMonthlySalary?: number;
    avgCalendarDaysPerMonth?: number;
    sickLeavePayRate?: number;
    vacationPayRate?: number;
    showPayrollColumns?: boolean;
};
export type VacationPayrollPrefs = {
    params: VacationPayrollParams;
    showColumns: boolean;
};
const defaultPrefs = (): VacationPayrollPrefs => ({
    params: { ...DEFAULT_VACATION_PAYROLL_PARAMS },
    showColumns: false,
});
function boxToParams(o: PayrollLsBox): VacationPayrollParams {
    return {
        avgMonthlySalary: clampNum(o.avgMonthlySalary, 0, 1e12, 0),
        avgCalendarDaysPerMonth: clampNum(o.avgCalendarDaysPerMonth, 1, 31, 29.3),
        sickLeavePayRate: clampNum(o.sickLeavePayRate, 0, 1, 0.6),
        vacationPayRate: clampNum(o.vacationPayRate, 0, 2, 1),
    };
}
export function loadVacationPayrollPrefs(year: number): VacationPayrollPrefs {
    try {
        const raw = localStorage.getItem(PAYROLL_LS_KEY);
        if (!raw)
            return defaultPrefs();
        const o = JSON.parse(raw) as PayrollLsBox;
        if (!o || o.year !== year)
            return defaultPrefs();
        return {
            params: boxToParams(o),
            showColumns: Boolean(o.showPayrollColumns),
        };
    }
    catch {
        return defaultPrefs();
    }
}
export function saveVacationPayrollPrefs(year: number, prefs: VacationPayrollPrefs): void {
    try {
        const p = prefs.params;
        const box: PayrollLsBox = {
            year,
            avgMonthlySalary: p.avgMonthlySalary,
            avgCalendarDaysPerMonth: p.avgCalendarDaysPerMonth,
            sickLeavePayRate: p.sickLeavePayRate,
            vacationPayRate: p.vacationPayRate,
            showPayrollColumns: prefs.showColumns,
        };
        localStorage.setItem(PAYROLL_LS_KEY, JSON.stringify(box));
    }
    catch {
    }
}
export function loadVacationPayrollParams(year: number): VacationPayrollParams {
    return loadVacationPayrollPrefs(year).params;
}
export function saveVacationPayrollParams(year: number, p: VacationPayrollParams): void {
    const cur = loadVacationPayrollPrefs(year);
    saveVacationPayrollPrefs(year, { ...cur, params: p });
}
function clampNum(v: unknown, min: number, max: number, fallback: number): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
export function buildUserKindYearCounts(marks: VacationMarksState, year: number, employeeIds: Set<number>): Map<number, Record<VacationAbsenceKind, number>> {
    const map = new Map<number, Record<VacationAbsenceKind, number>>();
    for (const id of employeeIds) {
        const row = {} as Record<VacationAbsenceKind, number>;
        for (const k of VACATION_ABSENCE_KINDS)
            row[k] = 0;
        map.set(id, row);
    }
    for (const key of Object.keys(marks)) {
        const p = parseVacationCellKey(key);
        if (!p || p.year !== year)
            continue;
        const cell = marks[key];
        if (!cell)
            continue;
        const row = map.get(p.userId);
        if (!row)
            continue;
        const k = cell.kind;
        if ((VACATION_ABSENCE_KINDS as readonly string[]).includes(k)) {
            row[k] += 1;
        }
    }
    return map;
}
export function avgDailyEarnings(params: VacationPayrollParams): number {
    const m = params.avgMonthlySalary;
    const d = params.avgCalendarDaysPerMonth;
    if (!(m > 0) || !(d > 0))
        return 0;
    return m / d;
}
export function vacationPayTotal(annualLeaveDays: number, params: VacationPayrollParams): number {
    const daily = avgDailyEarnings(params);
    if (!(daily > 0) || !(annualLeaveDays > 0))
        return 0;
    return annualLeaveDays * daily * params.vacationPayRate;
}
export function sickPayTotal(sickDays: number, params: VacationPayrollParams): number {
    const daily = avgDailyEarnings(params);
    if (!(daily > 0) || !(sickDays > 0))
        return 0;
    return sickDays * daily * params.sickLeavePayRate;
}
export function formatPayrollMoney(n: number): string {
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
}
