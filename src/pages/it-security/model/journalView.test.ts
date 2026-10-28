import { describe, expect, it } from 'vitest';
import { JOURNAL_UI_INITIAL, buildJournalView } from './journalView';

describe('buildJournalView', () => {
    it('без событий журнал пустой', () => {
        const view = buildJournalView(JOURNAL_UI_INITIAL);
        expect(view.rows).toEqual([]);
        expect(view.fileRows).toEqual([]);
        expect(view.userRows).toEqual([]);
        expect(view.showDetail).toBe(false);
        expect(view.isEmpty).toBe(true);
        expect(view.tiles.every((tile) => tile.value === 0)).toBe(true);
        expect(view.sideUsers.map((user) => user.id)).toEqual(['all']);
    });

    it('фильтр «Заблокировано» на пустом журнале ничего не показывает', () => {
        const view = buildJournalView({ ...JOURNAL_UI_INITIAL, status: 'blocked' });
        expect(view.rows.filter((row) => row.kind === 'event')).toEqual([]);
    });

    it('показывает событие, пришедшее с сервера', () => {
        const view = buildJournalView({
            ...JOURNAL_UI_INITIAL,
            monthsOpen: { '2026-10': true },
            remoteUsers: [{ id: 'PC|KL\\ivan', login: 'ivan', host: 'PC', dept: '' }],
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
                res: 'Telegram',
                note: '',
                u: 'PC|KL\\ivan',
                hasFile: true,
            }],
        });
        expect(view.rows.some((row) => row.kind === 'head' && row.day === '26.10.2026' && row.open === false)).toBe(true);
        expect(view.rows.some((row) => row.kind === 'event' && row.name === 'a.pdf')).toBe(false);
        const opened = buildJournalView({
            ...JOURNAL_UI_INITIAL,
            monthsOpen: { '2026-10': true },
            daysOpen: { '26.10.2026': true },
            remoteUsers: [{ id: 'PC|KL\\ivan', login: 'ivan', host: 'PC', dept: '' }],
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
                res: 'Telegram',
                note: '',
                u: 'PC|KL\\ivan',
                hasFile: true,
            }],
        });
        expect(opened.rows.some((row) => row.kind === 'event' && row.name === 'a.pdf')).toBe(true);
        expect(view.sideUsers.map((user) => user.id)).toContain('PC|KL\\ivan');
        expect(view.detail.hasFile).toBe(true);
        expect(view.periodLabel).toBe('26.10.2026');
    });

    it('старый месяц свёрнут, пока его не откроют', () => {
        const oldEvent = {
            id: 'old',
            d: '01.01.2020',
            t: '09:00:00',
            kind: 'send' as const,
            status: 'blocked' as const,
            ch: 'telegram' as const,
            name: 'old.pdf',
            dir: 'C:\\Users',
            proc: 'Telegram.exe',
            res: 'Telegram',
            note: '',
            u: 'PC|KL\\ivan',
        };
        const closed = buildJournalView({ ...JOURNAL_UI_INITIAL, remote: [oldEvent] });
        expect(closed.rows.some((row) => row.kind === 'month' && row.month === '2020-01' && row.open === false)).toBe(true);
        expect(closed.rows.some((row) => row.kind === 'event')).toBe(false);
        const opened = buildJournalView({
            ...JOURNAL_UI_INITIAL,
            monthsOpen: { '2020-01': true },
            daysOpen: { '01.01.2020': true },
            remote: [oldEvent],
        });
        expect(opened.rows.some((row) => row.kind === 'event' && row.name === 'old.pdf')).toBe(true);
    });

    it('не подставляет демо-пользователя', () => {
        const view = buildJournalView({ ...JOURNAL_UI_INITIAL, user: 'u02' });
        expect(view.report?.login).toBe('u02');
        expect(view.showUserColumn).toBe(false);
    });
});
