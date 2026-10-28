import { parseVacationCellKey, VACATION_ABSENCE_KINDS } from './vacationScheduleModel';
export const DEFAULT_VACATION_PAYROLL_PARAMS = {
    avgMonthlySalary: 0,
    avgCalendarDaysPerMonth: 29.3,
    sickLeavePayRate: 0.6,
    vacationPayRate: 1,
};
const PAYROLL_LS_KEY = 'kl-vacation-payroll-params-v1';
const defaultPrefs = () => ({
    params: { ...DEFAULT_VACATION_PAYROLL_PARAMS },
    showColumns: false,
});
function boxToParams(o) {
    return {
        avgMonthlySalary: clampNum(o.avgMonthlySalary, 0, 1e12, 0),
        avgCalendarDaysPerMonth: clampNum(o.avgCalendarDaysPerMonth, 1, 31, 29.3),
        sickLeavePayRate: clampNum(o.sickLeavePayRate, 0, 1, 0.6),
        vacationPayRate: clampNum(o.vacationPayRate, 0, 2, 1),
    };
}
export function loadVacationPayrollPrefs(year) {
    try {
        const raw = localStorage.getItem(PAYROLL_LS_KEY);
        if (!raw)
            return defaultPrefs();
        const o = JSON.parse(raw);
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
export function saveVacationPayrollPrefs(year, prefs) {
    try {
        const p = prefs.params;
        const box = {
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
export function loadVacationPayrollParams(year) {
    return loadVacationPayrollPrefs(year).params;
}
export function saveVacationPayrollParams(year, p) {
    const cur = loadVacationPayrollPrefs(year);
    saveVacationPayrollPrefs(year, { ...cur, params: p });
}
function clampNum(v, min, max, fallback) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
export function buildUserKindYearCounts(marks, year, employeeIds) {
    const map = new Map();
    for (const id of employeeIds) {
        const row = {};
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
        if (VACATION_ABSENCE_KINDS.includes(k)) {
            row[k] += 1;
        }
    }
    return map;
}
export function avgDailyEarnings(params) {
    const m = params.avgMonthlySalary;
    const d = params.avgCalendarDaysPerMonth;
    if (!(m > 0) || !(d > 0))
        return 0;
    return m / d;
}
export function vacationPayTotal(annualLeaveDays, params) {
    const daily = avgDailyEarnings(params);
    if (!(daily > 0) || !(annualLeaveDays > 0))
        return 0;
    return annualLeaveDays * daily * params.vacationPayRate;
}
export function sickPayTotal(sickDays, params) {
    const daily = avgDailyEarnings(params);
    if (!(daily > 0) || !(sickDays > 0))
        return 0;
    return sickDays * daily * params.sickLeavePayRate;
}
export function formatPayrollMoney(n) {
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
}
