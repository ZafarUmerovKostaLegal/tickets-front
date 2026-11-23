import type { AccessLevel, FileKind, FolderRow } from '../api/filesApi';

export function fmt(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function formatBytes(bytes: number, locale: string): string {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return '0 B';
    const units = locale === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] : ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const digits = unit === 0 || value >= 100 ? 0 : 1;
    return `${value.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: digits })} ${units[unit]}`;
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
    if (!value)
        return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export type PreviewMode = 'pdf' | 'image' | 'text' | null;

export function previewMode(kind: FileKind, contentType: string): PreviewMode {
    const type = contentType.toLowerCase();
    if (kind === 'pdf' || type === 'application/pdf')
        return 'pdf';
    if (kind === 'image' || type.startsWith('image/'))
        return 'image';
    if (kind === 'text' || type.startsWith('text/'))
        return 'text';
    return null;
}

export type FolderNode = FolderRow & { children: FolderNode[] };

export function buildFolderTree(folders: readonly FolderRow[]): FolderNode[] {
    const nodes = new Map<string, FolderNode>();
    for (const folder of folders)
        nodes.set(folder.id, { ...folder, children: [] });
    const roots: FolderNode[] = [];
    for (const node of nodes.values()) {
        const parent = node.parentId ? nodes.get(node.parentId) : undefined;
        if (parent)
            parent.children.push(node);
        else
            roots.push(node);
    }
    const sort = (list: FolderNode[]) => {
        list.sort((a, b) => a.name.localeCompare(b.name));
        for (const node of list)
            sort(node.children);
    };
    sort(roots);
    return roots;
}

export function folderSubtreeCount(node: FolderNode): number {
    return node.children.reduce((sum, child) => sum + folderSubtreeCount(child), node.documents);
}

export function folderAncestors(folders: readonly FolderRow[], folderId: string | null): string[] {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const out: string[] = [];
    const seen = new Set<string>();
    let current = folderId ? byId.get(folderId)?.parentId ?? null : null;
    while (current && !seen.has(current)) {
        seen.add(current);
        out.push(current);
        current = byId.get(current)?.parentId ?? null;
    }
    return out;
}

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, read: 1, edit: 2, manage: 3 };

export function canEdit(level: AccessLevel): boolean {
    return LEVEL_RANK[level] >= LEVEL_RANK.edit;
}

export function canManage(level: AccessLevel): boolean {
    return level === 'manage';
}

export function matchesFilter(query: string, ...values: Array<string | null | undefined>): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle)
        return true;
    return values.some((value) => (value ?? '').toLowerCase().includes(needle));
}

export function parseTemplate(text: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of text.split(/\r?\n/)) {
        const path = line.split('/').map((part) => part.trim()).filter(Boolean).join('/');
        if (!path || seen.has(path.toLowerCase()))
            continue;
        seen.add(path.toLowerCase());
        out.push(path);
    }
    return out;
}

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'thisMonth' | 'custom';
export type DateFilter = { preset: DatePreset; from: string; to: string };

const NAME_DATE = /^(\d{4})-(\d{2})-(\d{2})(?=[\s_.-]|$)/;

function localDay(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function documentDay(doc: { name: string; createdAt: string | null }): string {
    const fromName = NAME_DATE.exec(doc.name);
    if (fromName)
        return `${fromName[1]}-${fromName[2]}-${fromName[3]}`;
    if (!doc.createdAt)
        return '';
    const created = new Date(doc.createdAt);
    return Number.isNaN(created.getTime()) ? '' : localDay(created);
}

export function dateRange(filter: DateFilter, today: Date = new Date()): { from: string; to: string } {
    const shift = (days: number) => {
        const date = new Date(today);
        date.setDate(date.getDate() - days);
        return localDay(date);
    };
    switch (filter.preset) {
        case 'today':
            return { from: localDay(today), to: localDay(today) };
        case 'week':
            return { from: shift(6), to: localDay(today) };
        case 'month':
            return { from: shift(29), to: localDay(today) };
        case 'thisMonth':
            return { from: localDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDay(today) };
        case 'custom': {
            const [from, to] = filter.from && filter.to && filter.from > filter.to ? [filter.to, filter.from] : [filter.from, filter.to];
            return { from, to };
        }
        default:
            return { from: '', to: '' };
    }
}

export function inDateRange(day: string, range: { from: string; to: string }): boolean {
    if (!range.from && !range.to)
        return true;
    if (!day)
        return false;
    return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

export function isMailName(name: string): boolean {
    return /\.(eml|msg)$/i.test(name);
}

export type UploadSummary = Record<'created' | 'version' | 'unchanged' | 'exists' | 'duplicate', number>;

export function summarizeUpload(response: { documents: unknown[]; results?: Array<{ status: string }> }): UploadSummary {
    const out: UploadSummary = { created: 0, version: 0, unchanged: 0, exists: 0, duplicate: 0 };
    if (!response.results) {
        out.created = response.documents.length;
        return out;
    }
    for (const row of response.results) {
        if (row.status in out)
            out[row.status as keyof UploadSummary] += 1;
    }
    return out;
}
