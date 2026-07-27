export function formatHoursClockFromDecimalHours(h: number): string {
    if (!Number.isFinite(h) || h <= 0)
        return '0:00';
    const totalSec = Math.round(h * 3600);
    return formatHMSShort(totalSec);
}
export function decimalHoursFromElapsedMs(elapsedMs: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0)
        return 0;
    return Math.round((elapsedMs / 3600000) * 1000000) / 1000000;
}
export function formatDecimalHoursRu(n: number): string {
    if (!Number.isFinite(n))
        return '—';
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatReportBillableHoursRu(n: number): string {
    if (!Number.isFinite(n))
        return '—';
    const v = Math.round(n * 100000) / 100000;
    return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
}
export function formatHMS(totalSeconds: number): string {
    const s = Math.max(0, Number.isFinite(totalSeconds) ? Math.trunc(totalSeconds) : 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
export function formatHM(totalSeconds: number): string {
    const s = Math.max(0, Number.isFinite(totalSeconds) ? Math.trunc(totalSeconds) : 0);
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    const hh = m === 60 ? h + 1 : h;
    const mm = m === 60 ? 0 : m;
    return `${hh}:${String(mm).padStart(2, '0')}`;
}

export function formatDecimalHoursAsHm(decimalHours: number): string {
    if (!Number.isFinite(decimalHours) || decimalHours <= 0)
        return '0:00';
    return formatHM(Math.round(Math.max(0, decimalHours) * 3600));
}

export function roundDecimalHoursToMinute(h: number): number {
    if (!Number.isFinite(h) || h <= 0)
        return 0;
    return Math.round(Math.max(0, h) * 60) / 60;
}

export function sumDecimalHoursForMinuteDisplay(values: readonly number[]): number {
    let totalMinutes = 0;
    for (const h of values) {
        if (!Number.isFinite(h))
            continue;
        totalMinutes += Math.round(Math.max(0, h) * 60);
    }
    return totalMinutes / 60;
}

export function sanitizeColonHoursInput(raw: string): string {
    const v = raw.replace(/[^\d:]/g, '');
    const colon = v.indexOf(':');
    if (colon !== -1) {
        const h = v.slice(0, colon).replace(/\D/g, '').slice(0, 2);
        const m = v.slice(colon + 1).replace(/\D/g, '').slice(0, 2);
        return `${h}:${m}`;
    }
    return v.replace(/\D/g, '').slice(0, 3);
}

export function parseStrictDurationInputToDecimalHours(s: string): number | null {
    const clean = s.trim();
    if (!clean)
        return 0;
    if (clean.includes(':')) {
        const i = clean.indexOf(':');
        const hs = clean.slice(0, i).replace(/\D/g, '');
        const ms = clean.slice(i + 1).replace(/\D/g, '');
        if (ms.length > 2)
            return null;
        const h = hs === '' ? 0 : Number(hs);
        const m = ms === '' ? Number.NaN : Number(ms);
        if (Number.isNaN(h) || Number.isNaN(m) || m > 59)
            return null;
        return h + m / 60;
    }
    if (!/^\d+$/.test(clean))
        return null;
    if (clean.length === 3) {
        const h = Number(clean[0]);
        const m = Number(clean.slice(1));
        if (Number.isNaN(h) || Number.isNaN(m) || m > 59)
            return null;
        return h + m / 60;
    }
    if (clean.length <= 2) {
        const h = Number(clean);
        if (!Number.isFinite(h) || h < 0)
            return null;
        return h;
    }
    return null;
}

export function parseDecimalHoursFromDurationText(input: string | null | undefined): number | null {
    const sec = parseDurationToSeconds(input);
    if (sec === null)
        return null;
    return Math.max(0, sec / 3600);
}
export function formatHMSShort(totalSeconds: number): string {
    const s = Math.max(0, Number.isFinite(totalSeconds) ? Math.trunc(totalSeconds) : 0);
    if (s === 0)
        return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (sec === 0)
        return `${h}:${String(m).padStart(2, '0')}`;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
export function parseDurationToSeconds(input: string | null | undefined): number | null {
    if (input == null)
        return null;
    const s = String(input).trim().replace(',', '.');
    if (!s)
        return null;
    const m = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
    if (m) {
        const h = Number(m[1]);
        const min = Number(m[2]);
        const sec = m[3] ? Number(m[3]) : 0;
        return h * 3600 + min * 60 + sec;
    }
    if (/^\d+\s+\d+$/.test(s)) {
        const [hh, mm] = s.split(/\s+/).map(Number);
        return (hh || 0) * 3600 + (mm || 0) * 60;
    }
    if (/^\d+(\.\d+)?$/.test(s)) {
        return Math.round(Number(s) * 3600);
    }
    return null;
}
export const MIN_ENTRY_SECONDS = 60;
export const MAX_ENTRY_SECONDS = 86340;
export function isValidDurationSeconds(seconds: number): boolean {
    return (Number.isInteger(seconds) &&
        seconds >= MIN_ENTRY_SECONDS &&
        seconds <= MAX_ENTRY_SECONDS);
}
export function decimalHoursToSeconds(value: string | number | null | undefined): number {
    if (value == null || value === '')
        return 0;
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    return Math.round(n * 3600);
}
export function formatHours(value: string | number | null | undefined, digits = 2): string {
    if (value == null || value === '')
        return '—';
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n))
        return '—';
    return n.toFixed(digits);
}
