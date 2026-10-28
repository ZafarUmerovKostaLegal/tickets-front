import { getAttendanceApiBase, getApiBaseUrl } from '@shared/config';
function normalizeBase(value) {
    const s = value.replace(/\/+$/, '');
    if (s.endsWith('/api/v1'))
        return s.slice(0, -'/api/v1'.length);
    return s;
}
export function getAttendanceResolvedBaseUrl() {
    const dedicated = getAttendanceApiBase();
    if (dedicated)
        return normalizeBase(dedicated);
    return getApiBaseUrl();
}
export function getAttendanceApiUrl(path) {
    const base = getAttendanceResolvedBaseUrl();
    const p = path.startsWith('/') ? path : `/${path}`;
    if (!base)
        return p;
    return `${base}${p}`;
}
