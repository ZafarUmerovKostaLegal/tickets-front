/** What the document viewer can show, and the small parsers it needs (pure, unit-tested). */

export type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'csv' | 'docx' | 'xlsx' | 'archive' | 'email' | 'unsupported-archive';

export const TEXT_HEAD_BYTES = 256 * 1024;
/** Office files are rendered in the browser: keep them reasonably small. */
export const OFFICE_PREVIEW_LIMIT = 25 * 1024 * 1024;

const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');

const TEXT = new Set(['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'ini', 'html', 'htm', 'css', 'js', 'ts', 'sql', 'py']);
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']);
const VIDEO = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const AUDIO = new Set(['mp3', 'wav', 'm4a', 'ogg', 'oga', 'flac', 'aac']);

export function previewKindOf(name: string, contentType = ''): PreviewKind | null {
    const e = ext(name);
    const type = contentType.toLowerCase();
    if (e === 'pdf' || type === 'application/pdf')
        return 'pdf';
    if (e === 'zip' || type === 'application/zip' || type === 'application/x-zip-compressed')
        return 'archive';
    if (e === 'rar' || e === '7z' || e === 'tar' || e === 'gz')
        return 'unsupported-archive';
    if (e === 'eml' || type === 'message/rfc822')
        return 'email';
    if (e === 'docx')
        return 'docx';
    if (e === 'xlsx')
        return 'xlsx';
    if (e === 'csv' || type === 'text/csv')
        return 'csv';
    if (IMAGE.has(e) || type.startsWith('image/'))
        return 'image';
    if (VIDEO.has(e) || type.startsWith('video/'))
        return 'video';
    if (AUDIO.has(e) || type.startsWith('audio/'))
        return 'audio';
    if (TEXT.has(e) || type.startsWith('text/'))
        return 'text';
    return null;
}

/** RFC 4180-ish CSV (quotes, escaped quotes, `;` or `,`) — first `limit` rows. */
export function parseCsv(text: string, limit = 300): string[][] {
    const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
    const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length && rows.length < limit; i += 1) {
        const ch = text[i]!;
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"';
                i += 1;
            }
            else if (ch === '"') {
                quoted = false;
            }
            else {
                cell += ch;
            }
            continue;
        }
        if (ch === '"')
            quoted = true;
        else if (ch === sep) {
            row.push(cell);
            cell = '';
        }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n')
                i += 1;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        }
        else {
            cell += ch;
        }
    }
    if ((cell || row.length) && rows.length < limit) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

export type ArchiveEntry = { index: number; path: string; dir: boolean; size: number; compressed: number; modified: string | null; encrypted: boolean };
export type ArchiveListing = { supported: boolean; reason?: string; entries: ArchiveEntry[]; total: number; truncated: boolean; uncompressed: number };
export type ArchiveRow = { name: string; path: string; dir: boolean; size: number; entry: ArchiveEntry | null; count: number };

/** Children of `folder` ('' = root) — folders first; folders that exist only implicitly in paths are included. */
export function archiveFolder(entries: readonly ArchiveEntry[], folder: string): ArchiveRow[] {
    const prefix = folder ? `${folder.replace(/\/$/, '')}/` : '';
    const dirs = new Map<string, ArchiveRow>();
    const files: ArchiveRow[] = [];
    for (const entry of entries) {
        const path = entry.path.replace(/\/$/, '');
        if (!path.startsWith(prefix) || path === prefix.replace(/\/$/, ''))
            continue;
        const rest = path.slice(prefix.length);
        const [head, ...tail] = rest.split('/');
        if (!head)
            continue;
        if (tail.length || entry.dir) {
            const key = `${prefix}${head}`;
            const row = dirs.get(key) ?? { name: head, path: key, dir: true, size: 0, entry: null, count: 0 };
            if (!entry.dir) {
                row.size += entry.size;
                row.count += 1;
            }
            dirs.set(key, row);
        }
        else {
            files.push({ name: head, path, dir: false, size: entry.size, entry, count: 0 });
        }
    }
    const byName = (a: ArchiveRow, b: ArchiveRow) => a.name.localeCompare(b.name, 'ru', { numeric: true });
    return [...[...dirs.values()].sort(byName), ...files.sort(byName)];
}

export type EmailPreview = {
    subject: string;
    from: string;
    to: string;
    cc: string;
    date: string;
    html: string;
    text: string;
    attachments: Array<{ index: number; name: string; contentType: string; size: number }>;
};
