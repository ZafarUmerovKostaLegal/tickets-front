

import type { TimeExcelPreviewRow } from './previewExcelTypes';

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

export function getLocalYmdAndHmFromIso(iso: string): { ymd: string; hm: string } | null {
    const s = String(iso ?? '').trim();
    if (!s)
        return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return null;
    const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return { ymd, hm };
}


export function getLocalYmdFromIso(iso: string): string | null {
    return getLocalYmdAndHmFromIso(iso)?.ymd ?? null;
}


export function localYmdAndHmToIso(ymd: string, hm: string): string {
    const dPart = ymd.slice(0, 10);
    const m = /^(\d{1,2}):(\d{2})/.exec((hm || '12:00').trim());
    const hh = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 12;
    const mm = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    const p = dPart.split('-').map((x) => parseInt(x, 10));
    if (p.length < 3 || p.some((n) => !Number.isFinite(n)))
        return new Date().toISOString();
    const [y, mo, day] = p;
    const local = new Date(y, mo - 1, day, hh, mm, 0, 0);
    if (Number.isNaN(local.getTime()))
        return new Date().toISOString();
    return local.toISOString();
}

export function formatRuYmd(ymd: string): string {
    const p = ymd.slice(0, 10).split('-');
    if (p.length !== 3)
        return ymd;
    return `${p[2]}.${p[1]}.${p[0]}`;
}

export function formatRuHmFromIso(iso: string): string {
    const t = getLocalYmdAndHmFromIso(iso);
    if (!t)
        return '—';
    return t.hm;
}


export function recordedAtSortKeyMs(r: TimeExcelPreviewRow): number | null {
    const rec = String(r.recordedAt ?? '').trim();
    if (rec) {
        const t = Date.parse(rec);
        if (Number.isFinite(t))
            return t;
    }
    const wd = String(r.workDate ?? '').trim().slice(0, 10);
    if (wd && /^\d{4}-\d{2}-\d{2}$/.test(wd)) {
        const u = Date.parse(`${wd}T12:00:00`);
        if (Number.isFinite(u))
            return u;
    }
    if (r.rowKind === 'aggregate')
        return null;
    return null;
}
