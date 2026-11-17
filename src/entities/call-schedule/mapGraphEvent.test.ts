import { describe, expect, it } from 'vitest';
import { mapGraphEventToCallEvent } from './mapGraphEvent';

describe('mapGraphEventToCallEvent', () => {
    it('returns null for non-objects and events without id', () => {
        expect(mapGraphEventToCallEvent(null)).toBeNull();
        expect(mapGraphEventToCallEvent('x')).toBeNull();
        expect(mapGraphEventToCallEvent({ subject: 'No id' })).toBeNull();
    });

    it('maps date, time, duration and subject', () => {
        const ev = mapGraphEventToCallEvent({
            id: 'e1',
            subject: '  Созвон  ',
            start: { dateTime: '2026-11-17T10:00:00.0000000' },
            end: { dateTime: '2026-11-17T11:30:00.0000000' },
        });
        expect(ev).not.toBeNull();
        expect(ev!.id).toBe('e1');
        expect(ev!.title).toBe('Созвон');
        expect(ev!.date).toBe('2026-11-17');
        expect(ev!.time).toBe('10:00');
        expect(ev!.durationMin).toBe(90);
        expect(ev!.startMs).toBe(new Date('2026-11-17T10:00:00.000').getTime());
    });

    it('falls back to placeholder values when start is missing or invalid', () => {
        const ev = mapGraphEventToCallEvent({ id: 'e2', start: { dateTime: 'not-a-date' } });
        expect(ev).toEqual({ id: 'e2', title: 'Без темы', date: '1970-01-01', time: '—', startMs: 0, durationMin: 0 });
    });

    it('never produces a negative duration', () => {
        const ev = mapGraphEventToCallEvent({
            id: 'e3',
            start: { dateTime: '2026-11-17T12:00:00' },
            end: { dateTime: '2026-11-17T11:00:00' },
        });
        expect(ev!.durationMin).toBe(0);
    });

    it('strips HTML from the body and decodes entities', () => {
        const ev = mapGraphEventToCallEvent({
            id: 'e4',
            start: { dateTime: '2026-11-17T10:00:00' },
            body: { content: '<p>Повестка&nbsp;&amp; <b>итоги</b> &#8212; &lt;важно&gt;</p>' },
        });
        expect(ev!.description).toBe('Повестка & итоги — <важно>');
    });

    it('classifies the online meeting join URL', () => {
        const teams = mapGraphEventToCallEvent({
            id: 't',
            start: { dateTime: '2026-11-17T10:00:00' },
            onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' },
        });
        expect(teams!.teamsUrl).toBe('https://teams.microsoft.com/l/meetup-join/abc');
        expect(teams!.zoomUrl).toBeUndefined();

        const zoom = mapGraphEventToCallEvent({
            id: 'z',
            start: { dateTime: '2026-11-17T10:00:00' },
            onlineMeeting: { joinUrl: 'https://us02web.zoom.us/j/123' },
        });
        expect(zoom!.zoomUrl).toBe('https://us02web.zoom.us/j/123');
    });

    it('finds meeting links inside the body text and href attributes', () => {
        const ev = mapGraphEventToCallEvent({
            id: 'b',
            start: { dateTime: '2026-11-17T10:00:00' },
            body: { content: '<a href="https://meet.google.com/abc-defg-hij">Join</a> or https://acme.webex.com/meet/x' },
        });
        expect(ev!.googleMeetUrl).toBe('https://meet.google.com/abc-defg-hij');
        expect(ev!.webexUrl).toBe('https://acme.webex.com/meet/x');
    });

    it('prefers enriched meeting links from the backend over parsing', () => {
        const ev = mapGraphEventToCallEvent({
            id: 'en',
            start: { dateTime: '2026-11-17T10:00:00' },
            meetingJoinUrl: 'https://zoom.us/j/1',
            meetingLinks: [{ url: 'https://zoom.us/j/1', kind: 'zoom' }, { url: '  ' }, null, { url: 'https://x.test', kind: '' }],
            body: { content: 'https://teams.microsoft.com/l/should-be-ignored' },
        });
        expect(ev!.meetingJoinUrl).toBe('https://zoom.us/j/1');
        expect(ev!.meetingLinks).toEqual([
            { url: 'https://zoom.us/j/1', kind: 'zoom' },
            { url: 'https://x.test', kind: 'other' },
        ]);
        expect(ev!.teamsUrl).toBeUndefined();
    });

    it('formats participants and location', () => {
        const ev = mapGraphEventToCallEvent({
            id: 'p',
            start: { dateTime: '2026-11-17T10:00:00' },
            location: { displayName: 'ООО «Альфа»' },
            attendees: [
                { emailAddress: { name: 'Иван', address: 'ivan@a.uz' } },
                { emailAddress: { address: 'only@a.uz' } },
                { emailAddress: { name: 'Только имя' } },
                { emailAddress: {} },
            ],
        });
        expect(ev!.client).toBe('ООО «Альфа»');
        expect(ev!.participants).toEqual(['Иван (ivan@a.uz)', 'only@a.uz', 'Только имя']);
    });
});
