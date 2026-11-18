import { describe, expect, it } from 'vitest';
import type { FolderRow } from '../api/filesApi';
import {
    buildFolderTree,
    dateRange,
    documentDay,
    inDateRange,
    isMailName,
    summarizeUpload,
    canEdit,
    fmt,
    folderAncestors,
    folderSubtreeCount,
    formatBytes,
    parseTemplate,
    previewMode,
} from './filesFormat';

function folder(id: string, parentId: string | null, name: string, documents = 0): FolderRow {
    return { id, parentId, name, documents, createdAt: null, favorite: false };
}

describe('fmt', () => {
    it('подставляет известные переменные и оставляет неизвестные', () => {
        expect(fmt('Взят: {name}, v{version} {x}', { name: 'Анна', version: 3 })).toBe('Взят: Анна, v3 {x}');
    });
});

describe('formatBytes', () => {
    it('масштабирует единицы', () => {
        expect(formatBytes(0, 'en')).toBe('0 B');
        expect(formatBytes(512, 'en')).toBe('512 B');
        expect(formatBytes(1536, 'en')).toBe('1.5 KB');
        expect(formatBytes(5 * 1024 * 1024, 'ru')).toBe('5 МБ');
    });
});

describe('buildFolderTree', () => {
    const rows = [
        folder('c', null, 'Correspondence', 1),
        folder('e', 'c', 'Emails', 4),
        folder('a', null, 'Agreements', 2),
        folder('orphan', 'missing', 'Lost'),
    ];

    it('строит дерево, сортирует и поднимает сирот в корень', () => {
        const tree = buildFolderTree(rows);
        expect(tree.map((node) => node.id)).toEqual(['a', 'c', 'orphan']);
        expect(tree[1].children.map((node) => node.id)).toEqual(['e']);
        expect(folderSubtreeCount(tree[1])).toBe(5);
    });

    it('находит предков папки', () => {
        expect(folderAncestors(rows, 'e')).toEqual(['c']);
        expect(folderAncestors(rows, 'c')).toEqual([]);
        expect(folderAncestors(rows, null)).toEqual([]);
    });
});

describe('previewMode / canEdit', () => {
    it('распознаёт предпросматриваемые типы', () => {
        expect(previewMode('pdf', 'application/octet-stream')).toBe('pdf');
        expect(previewMode('file', 'image/png')).toBe('image');
        expect(previewMode('doc', 'application/msword')).toBeNull();
    });

    it('редактирование начиная с edit', () => {
        expect(canEdit('read')).toBe(false);
        expect(canEdit('edit')).toBe(true);
        expect(canEdit('manage')).toBe(true);
    });
});

describe('parseTemplate', () => {
    it('нормализует пути и убирает дубликаты', () => {
        expect(parseTemplate(' Correspondence \n\nCorrespondence / Emails\ncorrespondence\nDrafts')).toEqual([
            'Correspondence',
            'Correspondence/Emails',
            'Drafts',
        ]);
    });
});

describe('document dates', () => {
    const today = new Date(2026, 10, 18, 12);

    it('takes the letter date from the file name, otherwise the upload date', () => {
        expect(documentDay({ name: '2026-11-03_01_klennesh.eml', createdAt: '2026-11-17T10:00:00Z' })).toBe('2026-11-03');
        expect(documentDay({ name: '2026-11-04 Ivan - RE Follow [ab12cd].eml', createdAt: null })).toBe('2026-11-04');
        expect(documentDay({ name: 'SPA.docx', createdAt: '2026-11-17T10:00:00' })).toBe('2026-11-17');
        expect(documentDay({ name: '2026-11-033.docx', createdAt: null })).toBe('');
    });

    it('builds inclusive ranges for presets', () => {
        expect(dateRange({ preset: 'today', from: '', to: '' }, today)).toEqual({ from: '2026-11-18', to: '2026-11-18' });
        expect(dateRange({ preset: 'week', from: '', to: '' }, today)).toEqual({ from: '2026-11-12', to: '2026-11-18' });
        expect(dateRange({ preset: 'thisMonth', from: '', to: '' }, today)).toEqual({ from: '2026-11-01', to: '2026-11-18' });
        expect(dateRange({ preset: 'custom', from: '2026-11-10', to: '2026-11-01' }, today)).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    });

    it('filters by day; open bounds pass', () => {
        expect(inDateRange('2026-11-03', { from: '2026-11-01', to: '2026-11-03' })).toBe(true);
        expect(inDateRange('2026-11-04', { from: '2026-11-01', to: '2026-11-03' })).toBe(false);
        expect(inDateRange('2026-11-04', { from: '2026-11-04', to: '' })).toBe(true);
        expect(inDateRange('', { from: '', to: '' })).toBe(true);
        expect(inDateRange('', { from: '2026-11-01', to: '' })).toBe(false);
    });

    it('recognises letters', () => {
        expect(isMailName('a.EML')).toBe(true);
        expect(isMailName('a.msg')).toBe(true);
        expect(isMailName('a.pdf')).toBe(false);
    });
});

describe('summarizeUpload', () => {
    it('counts statuses and treats old responses as new files', () => {
        expect(summarizeUpload({ documents: [1, 2], results: [{ status: 'version' }, { status: 'duplicate' }, { status: 'odd' }] }))
            .toEqual({ created: 0, version: 1, unchanged: 0, exists: 0, duplicate: 1 });
        expect(summarizeUpload({ documents: [1, 2] }).created).toBe(2);
    });
});
