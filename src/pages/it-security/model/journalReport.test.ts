import { describe, expect, it } from 'vitest';
import { JOURNAL_UI_INITIAL, buildJournalView } from './journalView';
import { journalReportDocument } from './journalReport';

describe('journalReportDocument', () => {
    it('собирает отчёт выбранного пользователя и события', () => {
        const view = buildJournalView({
            ...JOURNAL_UI_INITIAL,
            user: 'PC|KL\\ivan',
            remoteUsers: [{ id: 'PC|KL\\ivan', login: 'ivan', host: 'PC', dept: 'IT' }],
            remote: [{
                id: 'e1',
                d: '26.10.2026',
                t: '12:00:00',
                kind: 'send',
                status: 'blocked',
                ch: 'telegram',
                name: 'a.pdf',
                dir: 'C:\\Users',
                proc: 'Telegram.exe',
                res: 'Telegram Desktop',
                note: '',
                u: 'PC|KL\\ivan',
            }],
        });
        const document = journalReportDocument(view, 'events');
        expect(document.fileName.endsWith('.pdf')).toBe(true);
        expect(document.fileName.includes('\\')).toBe(false);
        const text = document.blocks.flatMap((block) => [block.heading, ...block.lines]).join('\n');
        expect(text).toContain('Отчёт: PC\\ivan');
        expect(text).toContain('Блокировки по дням');
        expect(text).toContain('Telegram Desktop — 1');
        expect(text).toContain('a.pdf — 1');
        expect(text).toContain('a.pdf');
        expect(text).toContain('Заблокировано');
    });

    it('модуль скачивания собирается', async () => {
        const pdf = await import('./journalReportPdf');
        expect(typeof pdf.downloadJournalReport).toBe('function');
    });

    it('для пустого журнала пишет, что записей нет', () => {
        const document = journalReportDocument(buildJournalView(JOURNAL_UI_INITIAL), 'events');
        expect(document.blocks.some((block) => block.lines.includes('Нет записей'))).toBe(true);
    });
});
