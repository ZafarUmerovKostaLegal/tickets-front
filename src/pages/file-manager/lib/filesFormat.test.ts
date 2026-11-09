import { describe, expect, it } from 'vitest';
import type { FolderRow } from '../api/filesApi';
import {
    buildFolderTree,
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
