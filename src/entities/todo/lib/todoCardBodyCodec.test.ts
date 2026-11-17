import { describe, expect, it } from 'vitest';
import type { TodoCard } from '@entities/todo/lib/todoUtils';
import { cardToExtras, mergeCardBody, splitCardBody } from './todoCardBodyCodec';
import { cardDueDateTimeToIso, isoDueToParts } from './todoDueAt';

const MARKER = '\n\n<<<KL_TODO_CARD_JSON>>>';

describe('todoCardBodyCodec', () => {
    it('returns plain description when there is no marker', () => {
        expect(splitCardBody(null)).toEqual({ description: '', extras: {} });
        expect(splitCardBody('  Просто текст  ')).toEqual({ description: 'Просто текст', extras: {} });
    });

    it('round-trips description and extras', () => {
        const extras = {
            labels: [{ id: 'l1', name: 'Срочно', color: 'red' }],
            dueDate: '2026-11-20',
            dueTime: '18:00',
            checklist: [{ id: 'c1', text: 'Пункт', done: false }],
            members: ['1', '2'],
        };
        const body = mergeCardBody('Описание задачи   ', extras as never);
        expect(body.startsWith('Описание задачи')).toBe(true);
        expect(body).toContain('<<<KL_TODO_CARD_JSON>>>');
        const split = splitCardBody(body);
        expect(split.description).toBe('Описание задачи');
        expect(split.extras).toEqual(extras);
    });

    it('does not append a marker when extras are empty', () => {
        expect(mergeCardBody('Текст', {})).toBe('Текст');
        expect(mergeCardBody('Текст', { labels: [], checklist: [] })).toBe('Текст');
    });

    it('stores extras even without a description', () => {
        const body = mergeCardBody('', { dueDate: '2026-01-01' });
        expect(splitCardBody(body)).toEqual({ description: '', extras: { dueDate: '2026-01-01' } });
    });

    it('treats broken JSON after the marker as plain text', () => {
        const raw = `Текст${MARKER}{broken`;
        expect(splitCardBody(raw)).toEqual({ description: raw, extras: {} });
        const rawArr = `Текст${MARKER}[1,2]`;
        expect(splitCardBody(rawArr).extras).toEqual({});
    });

    it('ignores fields with unexpected types', () => {
        const raw = `T${MARKER}${JSON.stringify({ labels: 'x', dueDate: 5, members: ['a'] })}`;
        expect(splitCardBody(raw).extras).toEqual({ members: ['a'] });
    });

    it('extracts extras from a card, mapping legacy participants to members', () => {
        const extras = cardToExtras({
            id: '1',
            title: 'Карточка',
            labels: [],
            participantUserIds: [5, 6],
            dueDate: '2026-11-20',
            dueTime: '',
        } as unknown as TodoCard);
        expect(extras).toEqual({
            labels: undefined,
            dueDate: '2026-11-20',
            dueTime: undefined,
            startDate: undefined,
            startTime: undefined,
            checklist: undefined,
            members: ['5', '6'],
            attachments: undefined,
        });
    });
});

describe('todoDueAt', () => {
    it('returns null without a due date', () => {
        expect(cardDueDateTimeToIso()).toBeNull();
        expect(cardDueDateTimeToIso('  ')).toBeNull();
        expect(cardDueDateTimeToIso('not-a-date')).toBeNull();
    });

    it('defaults the time to the end of the day and clamps values', () => {
        expect(cardDueDateTimeToIso('2026-11-20')).toBe(new Date('2026-11-20T23:59:00').toISOString());
        expect(cardDueDateTimeToIso('2026-11-20', '99:99')).toBe(new Date('2026-11-20T23:59:00').toISOString());
        expect(cardDueDateTimeToIso('2026-11-20', '09:05')).toBe(new Date('2026-11-20T09:05:00').toISOString());
    });

    it('splits an ISO timestamp into local date and time', () => {
        const iso = new Date('2026-11-20T09:05:00').toISOString();
        expect(isoDueToParts(iso)).toEqual({ dueAtIso: iso, dueDate: '2026-11-20', dueTime: '09:05' });
        expect(isoDueToParts(null)).toEqual({});
        expect(isoDueToParts('bad')).toEqual({});
    });
});
