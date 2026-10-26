import { describe, expect, it } from 'vitest';
import { JOURNAL_UI_INITIAL, buildJournalView } from './journalView';

describe('buildJournalView', () => {
    it('показывает события и карточку файла', () => {
        const view = buildJournalView(JOURNAL_UI_INITIAL);
        expect(view.rows.some((row) => row.kind === 'event')).toBe(true);
        expect(view.showDetail).toBe(true);
        expect(view.detail.name.length).toBeGreaterThan(0);
        expect(view.tiles[0]?.value).toBeGreaterThan(0);
    });

    it('фильтр «Заблокировано» оставляет только блокировки', () => {
        const view = buildJournalView({ ...JOURNAL_UI_INITIAL, status: 'blocked' });
        const events = view.rows.filter((row) => row.kind === 'event');
        expect(events.length).toBeGreaterThan(0);
        expect(events.every((row) => row.kind === 'event' && row.status === 'blocked')).toBe(true);
    });

    it('выбор пользователя открывает отчёт', () => {
        const view = buildJournalView({ ...JOURNAL_UI_INITIAL, user: 'u02' });
        expect(view.showReport).toBe(true);
        expect(view.report?.login).toContain('a.saidov');
        expect(view.showUserColumn).toBe(false);
    });
});
