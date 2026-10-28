import { describe, expect, it } from 'vitest';
import type { FileGuardStoredFile } from './fileGuardApi';
import { filterStorageFiles, formatFileSize, groupStorageByMonth } from './fileGuardStorage';

function file(patch: Partial<FileGuardStoredFile>): FileGuardStoredFile {
    return {
        id: '11111111-1111-1111-1111-111111111111',
        fileName: 'a.pdf',
        fileSize: 2048,
        host: 'PC',
        windowsUser: 'KOSTA\\ivan',
        occurredAt: '2026-10-04T08:00:00.000Z',
        copies: 1,
        users: [{ host: 'PC', windowsUser: 'KOSTA\\ivan' }],
        ...patch,
    };
}

describe('file storage groups', () => {
    it('складывает файлы по месяцам, новый месяц сверху', () => {
        const groups = groupStorageByMonth([
            file({ id: '11111111-1111-1111-1111-111111111111', occurredAt: '2026-09-02T08:00:00.000Z', fileSize: 1000 }),
            file({ id: '22222222-2222-2222-2222-222222222222', occurredAt: '2026-10-04T08:00:00.000Z', fileName: 'oct.pdf', fileSize: 500 }),
        ], new Date(2026, 9, 28));
        expect(groups.map((group) => group.key)).toEqual(['2026-10', '2026-09']);
        expect(groups[0].label).toBe('Октябрь 2026');
        expect(groups[0].openByDefault).toBe(true);
        expect(groups[1].openByDefault).toBe(false);
        expect(groups[0].bytes).toBe(500);
        expect(formatFileSize(1536)).toBe('1.5 КБ');
    });

    it('фильтр пользователя оставляет файл, если он есть среди копий', () => {
        const items = [file({
            users: [
                { host: 'PC', windowsUser: 'KOSTA\\ivan' },
                { host: 'OTHER', windowsUser: 'KOSTA\\petr' },
            ],
        })];
        expect(filterStorageFiles(items, '', 'OTHER|KOSTA\\petr')).toHaveLength(1);
        expect(filterStorageFiles(items, 'oct', 'all')).toHaveLength(0);
        expect(filterStorageFiles(items, 'a.pdf', 'PC|KOSTA\\ivan')).toHaveLength(1);
    });
});
