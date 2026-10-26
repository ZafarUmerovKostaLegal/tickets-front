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

    it('не подставляет демо-пользователя', () => {
        const view = buildJournalView({ ...JOURNAL_UI_INITIAL, user: 'u02' });
        expect(view.report?.login).toBe('u02');
        expect(view.showUserColumn).toBe(false);
    });
});
