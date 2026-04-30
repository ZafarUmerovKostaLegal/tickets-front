import { isWorkDateInClosedReportingPeriod } from './weeklyReportingLock';

const STORAGE_KEY = 'tt_time_entry_edit_unlock_v1';

function compoundKey(authUserId: number, workDateYmd: string): string {
    return `${authUserId}:${workDateYmd.trim().slice(0, 10)}`;
}

function readMap(): Record<string, string> {
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {};
        const o = JSON.parse(raw) as unknown;
        return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, string> : {};
    }
    catch {
        return {};
    }
}

function writeMap(m: Record<string, string>): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    }
    catch {
    }
}

function parseIsoMs(iso: string): number {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : NaN;
}

function pruneExpired(m: Record<string, string>, nowMs: number): void {
    for (const key of Object.keys(m)) {
        const ms = parseIsoMs(m[key]!);
        if (!Number.isFinite(ms) || ms <= nowMs)
            delete m[key];
    }
}

/** Persist successful POST unlock or hint from API row; keeps the latest expiry per user+day. */
export function recordTimeEntryEditUnlockExpiry(authUserId: number, workDateYmd: string, expiresAtIso: string): void {
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

export function getActiveTimeEntryEditUnlockExpiresAtIso(authUserId: number, workDateYmd: string, now = new Date()): string | null {
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

export function isWorkDateTemporarilyUnlockedForSubject(authUserId: number, workDateYmd: string, now = new Date()): boolean {
    return getActiveTimeEntryEditUnlockExpiresAtIso(authUserId, workDateYmd, now) != null;
}

/** True if edits should be refused client-side for this subject/day (closed week and no manager bypass / no active unlock). */
export function isClosedReportingWeekEditingBlockedForSubject(subjectAuthUserId: number, workDateYmd: string, viewerCanOverrideWeeklyLock: boolean, now = new Date()): boolean {
    const wd = workDateYmd.trim().slice(0, 10);
    if (!isWorkDateInClosedReportingPeriod(wd, now))
        return false;
    if (viewerCanOverrideWeeklyLock)
        return false;
    return !isWorkDateTemporarilyUnlockedForSubject(subjectAuthUserId, wd, now);
}

/** When backend sends unlock expiry on time-entry rows, merge into session cache (same-tab refresh). */
export function absorbTimeEntryRowEditUnlockHint(row: {
    auth_user_id: number;
    work_date: string;
} & Record<string, unknown>): void {
    const uid = Number(row.auth_user_id);
    const wd = String(row.work_date ?? '').trim().slice(0, 10);
    const candidates = ['editUnlockExpiresAt', 'edit_unlock_expires_at', 'timeEntryEditUnlockExpiresAt', 'time_entry_edit_unlock_expires_at'];
    let exp: string | null = null;
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
