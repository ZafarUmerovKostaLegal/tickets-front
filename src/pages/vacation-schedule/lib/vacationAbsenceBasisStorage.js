import { parseVacationCellKey } from './vacationScheduleModel';
const STORAGE_KEY = 'vacationAbsenceBasis:v1';
const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 400 * 1024;
const MAX_TOTAL_STORAGE_CHARS = 2_400_000;
function safeJsonParse(raw) {
    if (raw == null || raw === '')
        return null;
    try {
        const v = JSON.parse(raw);
        if (v == null || typeof v !== 'object' || Array.isArray(v))
            return null;
        return v;
    }
    catch {
        return null;
    }
}
export function loadVacationAbsenceBasisMap() {
    if (typeof localStorage === 'undefined')
        return {};
    return safeJsonParse(localStorage.getItem(STORAGE_KEY)) ?? {};
}
function persistMap(map) {
    if (typeof localStorage === 'undefined')
        return;
    const s = JSON.stringify(map);
    if (s.length > MAX_TOTAL_STORAGE_CHARS) {
        console.warn('[vacation basis] localStorage payload too large; not saved');
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, s);
    }
    catch (e) {
        console.warn('[vacation basis] localStorage write failed', e);
    }
}
export function getVacationAbsenceBasis(cellKey, map) {
    return (map ?? loadVacationAbsenceBasisMap())[cellKey];
}
export function setVacationAbsenceBasis(cellKey, basis, prevMap) {
    const map = { ...(prevMap ?? loadVacationAbsenceBasisMap()) };
    if (basis == null || (!basis.comment.trim() && basis.attachments.length === 0)) {
        delete map[cellKey];
    }
    else {
        map[cellKey] = {
            comment: basis.comment.trim(),
            attachments: basis.attachments,
        };
    }
    persistMap(map);
    return map;
}
export function removeVacationAbsenceBasis(cellKey, prevMap) {
    return setVacationAbsenceBasis(cellKey, null, prevMap);
}
export function pruneVacationAbsenceBasisForYear(year, markKeys, prevMap) {
    const map = prevMap ?? loadVacationAbsenceBasisMap();
    let changed = false;
    const next = { ...map };
    for (const k of Object.keys(next)) {
        const p = parseVacationCellKey(k);
        if (p?.year !== year)
            continue;
        if (!markKeys.has(k)) {
            delete next[k];
            changed = true;
        }
    }
    if (changed)
        persistMap(next);
    return changed ? next : map;
}
export function basisSummaryForTooltip(basis) {
    if (!basis)
        return undefined;
    const parts = [];
    const c = basis.comment.trim();
    if (c) {
        const short = c.length > 120 ? `${c.slice(0, 117)}…` : c;
        parts.push(`Основание: ${short}`);
    }
    if (basis.attachments.length) {
        parts.push(basis.attachments.length === 1
            ? `Файл: ${basis.attachments[0].name}`
            : `Файлы: ${basis.attachments.length} шт.`);
    }
    return parts.length ? parts.join(' · ') : undefined;
}
export function hasVacationAbsenceBasisContent(basis) {
    if (!basis)
        return false;
    return basis.comment.trim().length > 0 || basis.attachments.length > 0;
}
export const vacationAbsenceBasisLimits = {
    maxAttachments: MAX_ATTACHMENTS,
    maxFileBytes: MAX_FILE_BYTES,
};
export async function readFileAsBasisAttachment(file) {
    if (file.size > MAX_FILE_BYTES)
        return `Файл слишком большой (макс. ${Math.round(MAX_FILE_BYTES / 1024)} КБ): ${file.name}`;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl)
                resolve('Не удалось прочитать файл');
            else
                resolve({
                    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                        ? crypto.randomUUID()
                        : `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    name: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    dataUrl,
                });
        };
        reader.onerror = () => resolve('Ошибка чтения файла');
        reader.readAsDataURL(file);
    });
}
