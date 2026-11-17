import { describe, expect, it } from 'vitest';
import { buildCallJoinLinkList, hasAnyJoinLink } from './callJoinLinks';
import type { CallEvent } from './mapGraphEvent';

const base: CallEvent = { id: '1', title: 'Call', date: '2026-11-17', time: '10:00', startMs: 0, durationMin: 30 };

describe('buildCallJoinLinkList', () => {
    it('returns nothing when the event has no links', () => {
        expect(buildCallJoinLinkList(base)).toEqual([]);
        expect(hasAnyJoinLink(base)).toBe(false);
    });

    it('builds legacy rows in a stable provider order and dedupes urls', () => {
        const rows = buildCallJoinLinkList({
            ...base,
            zoomUrl: 'https://zoom.us/j/1',
            teamsUrl: ' https://teams.microsoft.com/l/1 ',
            googleMeetUrl: 'https://zoom.us/j/1',
        });
        expect(rows.map((r) => r.key)).toEqual(['teams', 'zoom']);
        expect(rows[0]!.url).toBe('https://teams.microsoft.com/l/1');
    });

    it('labels Outlook web links and generic meeting urls', () => {
        const outlook = buildCallJoinLinkList({ ...base, meetingUrl: 'https://outlook.office.com/calendar/item/1' });
        expect(outlook).toEqual([expect.objectContaining({ key: 'outlook', className: 'csched-modal__join--outlook' })]);

        const generic = buildCallJoinLinkList({ ...base, meetingUrl: 'https://example.com/room' });
        expect(generic).toEqual([expect.objectContaining({ key: 'web', className: 'csched-modal__join--generic' })]);
    });

    it('uses enriched links, putting the primary join url first', () => {
        const rows = buildCallJoinLinkList({
            ...base,
            meetingJoinUrl: 'https://teams.microsoft.com/l/main',
            meetingLinks: [
                { url: 'https://zoom.us/j/9', kind: 'zoom' },
                { url: 'https://teams.microsoft.com/l/main', kind: 'teams' },
                { url: 'https://outlook.live.com/owa/x', kind: 'other' },
                { url: 'https://goto.com/1', kind: 'goto' },
            ],
        });
        expect(rows.map((r) => r.url)).toEqual([
            'https://teams.microsoft.com/l/main',
            'https://zoom.us/j/9',
            'https://outlook.live.com/owa/x',
            'https://goto.com/1',
        ]);
        expect(rows[0]!.className).toBe('csched-modal__join--teams');
        expect(rows[2]!.label).toBe('Открыть в Outlook (веб)');
        expect(rows[3]!.label).toBe('Открыть в GoTo Meeting');
        expect(rows[3]!.className).toBe('csched-modal__join--generic');
    });

    it('detects any kind of join link', () => {
        expect(hasAnyJoinLink({ ...base, webexUrl: 'https://x.webex.com/1' })).toBe(true);
        expect(hasAnyJoinLink({ ...base, meetingLinks: [{ url: 'u', kind: 'zoom' }] })).toBe(true);
        expect(hasAnyJoinLink({ ...base, meetingJoinUrl: 'u' })).toBe(true);
    });
});
