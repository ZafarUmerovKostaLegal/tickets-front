import type { AttendanceQuery } from '../model/types';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STR_LEN = 256;
const MAX_RECORDS = 10000;
function safeStr(val: unknown): string {
    if (val == null || typeof val !== 'string')
        return '';
    return String(val).trim().slice(0, MAX_STR_LEN);
}
function isValidDate(val: string): boolean {
    return DATE_REGEX.test(val.trim());
}
export function buildAttendanceQuery(options: AttendanceQuery): string {
    const dateFrom = safeStr(options.dateFrom);
    if (!dateFrom || !isValidDate(dateFrom)) {
        throw new Error('dateFrom обязателен и должен быть в формате YYYY-MM-DD');
    }
    const params = new URLSearchParams();
    params.set('date_from', dateFrom);
    const dateTo = safeStr(options.dateTo);
    if (dateTo && isValidDate(dateTo))
        params.set('date_to', dateTo);
    const personId = safeStr(options.personId);
    if (personId)
        params.set('person_id', personId);
    const name = safeStr(options.name);
    if (name)
        params.set('name', name);
    const department = safeStr(options.department);
    if (department)
        params.set('department', department);
    const checkpoint = safeStr(options.checkpoint);
    if (checkpoint)
        params.set('checkpoint', checkpoint);
    const status = safeStr(options.status);
    if (status)
        params.set('attendance_status', status);
    const cameraIp = safeStr(options.cameraIp);
    if (cameraIp)
        params.set('camera_ip', cameraIp);
    const maxRec = options.maxRecordsPerDevice;
    if (typeof maxRec === 'number' && Number.isFinite(maxRec) && maxRec > 0 && maxRec <= MAX_RECORDS) {
        params.set('max_records_per_device', String(Math.floor(maxRec)));
    }
    return params.toString();
}
