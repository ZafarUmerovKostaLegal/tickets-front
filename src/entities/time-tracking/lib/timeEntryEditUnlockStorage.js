import { isWorkDateInClosedReportingPeriod } from './weeklyReportingLock';
import { isWorkDateInSubmittedWeek } from './weeklySubmittedWeeks';
const STORAGE_KEY = 'tt_time_entry_edit_unlock_v1';
function compoundKey(authUserId, workDateYmd) {
    return `${authUserId}:${workDateYmd.trim().slice(0, 10)}`;
}
function readMap() {
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {};
        const o = JSON.parse(raw);
        return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    }
    catch {
        return {};
    }
}
function writeMap(m) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    }
    catch {
    }
}
function parseIsoMs(iso) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : NaN;
}
function pruneExpired(m, nowMs) {
    for (const key of Object.keys(m)) {
        const ms = parseIsoMs(m[key]);
        if (!Number.isFinite(ms) || ms <= nowMs)
            delete m[key];
    }
}
export function recordTimeEntryEditUnlockExpiry(authUserId, workDateYmd, expiresAtIso) {
    const k = compoundKey(authUserId, workDateYmd);
    const nextMs = parseIsoMs(expiresAtIso);
    if (!Number.isFinite(nextMs))
        return;
    const m = readMap();
    pruneExpired(m, Date.now());
    const prev = m[k];
    if (prev) {
        const prevMs = parseIsoMs(prev);
        if (Number.isFinite(prevMs) && prevMs >= nextMs)
            return;
    }
    m[k] = new Date(nextMs).toISOString();
    writeMap(m);
}
export function getActiveTimeEntryEditUnlockExpiresAtIso(authUserId, workDateYmd, now = new Date()) {
    const m = readMap();
    pruneExpired(m, now.getTime());
    writeMap(m);
    const iso = m[compoundKey(authUserId, workDateYmd)];
    if (!iso)
        return null;
    const ms = parseIsoMs(iso);
    if (!Number.isFinite(ms) || ms <= now.getTime())
        return null;
    return iso;
}
export function isWorkDateTemporarilyUnlockedForSubject(authUserId, workDateYmd, now = new Date()) {
    return getActiveTimeEntryEditUnlockExpiresAtIso(authUserId, workDateYmd, now) != null;
}
export function isClosedReportingWeekEditingBlockedForSubject(subjectAuthUserId, workDateYmd, viewerCanOverrideWeeklyLock, now = new Date()) {
    const wd = workDateYmd.trim().slice(0, 10);
    if (viewerCanOverrideWeeklyLock)
        return false;
    if (isWorkDateTemporarilyUnlockedForSubject(subjectAuthUserId, wd, now))
        return false;
    if (isWorkDateInSubmittedWeek(subjectAuthUserId, wd)) {
        if (!isWorkDateInClosedReportingPeriod(wd, now))
            return false;
        return true;
    }
    if (!isWorkDateInClosedReportingPeriod(wd, now))
        return false;
    return true;
}
export function absorbTimeEntryRowEditUnlockHint(row) {
    const uid = Number(row.auth_user_id);
    const wd = String(row.work_date ?? '').trim().slice(0, 10);
    const candidates = ['editUnlockExpiresAt', 'edit_unlock_expires_at', 'timeEntryEditUnlockExpiresAt', 'time_entry_edit_unlock_expires_at'];
    let exp = null;
    for (const ck of candidates) {
        const v = row[ck];
        if (typeof v === 'string' && v.trim()) {
            exp = v.trim();
            break;
        }
    }
    if (!Number.isFinite(uid) || wd.length !== 10 || !exp)
        return;
    recordTimeEntryEditUnlockExpiry(uid, wd, exp);
}
