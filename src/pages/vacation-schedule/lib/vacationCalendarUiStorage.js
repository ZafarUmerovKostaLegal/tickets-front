const STORAGE_KEY = 'kl-vacation-calendar-ui-v1';
const STATUSES = ['all', 'away', 'planned', 'declined'];
const KINDS = ['annual', 'sick', 'dayoff', 'business', 'remote', 'red_pass'];
const EMPTY_STAFF = {
    query: '',
    teamFilterIds: [],
    hiddenOpen: false,
    collapsedTeamIds: [],
};
function numberList(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => Number.isInteger(item) && item !== 0);
}
function stringList(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string' && item.length > 0);
}
function readDay(value) {
    if (!value || typeof value !== 'object')
        return null;
    const row = value;
    if (!Number.isInteger(row.monthIndex) || !Number.isInteger(row.day))
        return null;
    const monthIndex = row.monthIndex;
    const day = row.day;
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31)
        return null;
    return { monthIndex, day };
}
export function loadVacationCalendarUi() {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        const year = Number(parsed.year);
        if (!Number.isInteger(year) || year < 2000 || year > 2100)
            return null;
        const viewMonth = parsed.viewMonth == null
            ? null
            : Number(parsed.viewMonth);
        const status = STATUSES.find((item) => item === parsed.status) ?? 'all';
        const hiddenKinds = stringList(parsed.hiddenKinds).filter((kind) => (KINDS.includes(kind)));
        const staffRaw = parsed.staff && typeof parsed.staff === 'object'
            ? parsed.staff
            : {};
        const periodRaw = parsed.selectedPeriod;
        const start = periodRaw && typeof periodRaw === 'object' ? readDay(periodRaw.start) : null;
        const end = periodRaw && typeof periodRaw === 'object' ? readDay(periodRaw.end) : null;
        return {
            year,
            viewMonth: viewMonth != null && viewMonth >= 0 && viewMonth <= 11 ? viewMonth : null,
            monthPanelOpen: parsed.monthPanelOpen !== false,
            status,
            hiddenKinds,
            selectedEmployeeIds: numberList(parsed.selectedEmployeeIds),
            selectedPeriod: start && end ? { start, end } : null,
            staff: {
                query: typeof staffRaw.query === 'string' ? staffRaw.query : '',
                teamFilterIds: stringList(staffRaw.teamFilterIds),
                hiddenOpen: staffRaw.hiddenOpen === true,
                collapsedTeamIds: stringList(staffRaw.collapsedTeamIds),
            },
            hideLates: parsed.hideLates === true,
        };
    }
    catch {
        return null;
    }
}
export function saveVacationCalendarUi(state) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch {
        // The page still works if the browser refuses to store the view.
    }
}
export function emptyVacationStaffUi() {
    return { ...EMPTY_STAFF, teamFilterIds: [], collapsedTeamIds: [] };
}
