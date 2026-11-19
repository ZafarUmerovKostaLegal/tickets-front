import { describe, expect, it } from 'vitest';
import { archiveFolder, parseCsv, previewKindOf, type ArchiveEntry } from './previewKinds';

describe('previewKindOf', () => {
    it.each([
        ['Договор.pdf', '', 'pdf'],
        ['Data room.zip', '', 'archive'],
        ['backup.rar', '', 'unsupported-archive'],
        ['letter.eml', '', 'email'],
        ['SPA.docx', '', 'docx'],
        ['Budget.xlsx', '', 'xlsx'],
        ['export.csv', '', 'csv'],
        ['scan.JPG', '', 'image'],
        ['call.mp4', '', 'video'],
        ['memo.m4a', '', 'audio'],
        ['notes.md', '', 'text'],
        ['old.doc', 'application/msword', null],
    ] as const)('%s → %s', (name, type, kind) => {
        expect(previewKindOf(name, type)).toBe(kind);
    });
});

describe('parseCsv', () => {
    it('handles quotes, escaped quotes, CRLF and the Excel ; separator', () => {
        expect(parseCsv('Имя;Сумма\r\n"Иванов; И.";"1 000"\r\n"say ""hi""";2')).toEqual([
            ['Имя', 'Сумма'],
            ['Иванов; И.', '1 000'],
            ['say "hi"', '2'],
        ]);
    });
});

describe('archiveFolder', () => {
    const entry = (index: number, path: string, size = 10, dir = false): ArchiveEntry => ({ index, path, dir, size, compressed: size, modified: null, encrypted: false });
    const entries = [entry(0, 'Договоры/', 0, true), entry(1, 'Договоры/SPA.pdf', 100), entry(2, 'Договоры/2026/NDA.pdf', 50), entry(3, 'readme.md', 5), entry(4, 'Сканы/1.jpg', 7)];

    it('lists folders first, including folders that exist only in paths', () => {
        expect(archiveFolder(entries, '').map((row) => [row.name, row.dir, row.size])).toEqual([
            ['Договоры', true, 150],
            ['Сканы', true, 7],
            ['readme.md', false, 5],
        ]);
    });

    it('opens a nested folder', () => {
        expect(archiveFolder(entries, 'Договоры').map((row) => row.name)).toEqual(['2026', 'SPA.pdf']);
        expect(archiveFolder(entries, 'Договоры/2026')[0]?.entry?.index).toBe(2);
    });
});
