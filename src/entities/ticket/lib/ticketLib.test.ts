import { describe, expect, it } from 'vitest';
import type { PriorityItem } from '../model/types';
import { coerceTicketFormPriority, normalizeTicketPriorityForApi, resolveDefaultTicketPriority } from './ticketPriority';
import { buildTicketsPayload, buildTicketsQuery } from './query';

const priorities = [
    { value: 'Низкий', label: 'Низкий' },
    { value: 'Средний', label: 'Средний' },
    { value: 'Высокий', label: 'High' },
] as PriorityItem[];

describe('ticketPriority', () => {
    it('defaults to "Средний" when the list is empty or the value is blank', () => {
        expect(resolveDefaultTicketPriority()).toBe('Средний');
        expect(normalizeTicketPriorityForApi('  ', priorities)).toBe('Средний');
    });

    it('picks the medium priority from the list, otherwise the first one', () => {
        expect(resolveDefaultTicketPriority(priorities)).toBe('Средний');
        expect(resolveDefaultTicketPriority([{ value: 'p1', label: 'P1' }] as PriorityItem[])).toBe('p1');
    });

    it('matches by value or label and maps English slugs to Russian', () => {
        expect(normalizeTicketPriorityForApi('High', priorities)).toBe('Высокий');
        expect(normalizeTicketPriorityForApi('low', priorities)).toBe('Низкий');
        expect(normalizeTicketPriorityForApi('critical', priorities)).toBe('Критический');
        expect(normalizeTicketPriorityForApi('custom', priorities)).toBe('custom');
    });

    it('coerces unknown form values back to the default', () => {
        expect(coerceTicketFormPriority('custom', priorities)).toBe('Средний');
        expect(coerceTicketFormPriority('high', priorities)).toBe('Высокий');
        expect(coerceTicketFormPriority('anything', [])).toBe('anything');
    });
});

describe('ticket query builders', () => {
    it('serialises only provided params', () => {
        expect(buildTicketsQuery({})).toBe('');
        expect(buildTicketsQuery({ skip: 0, limit: 20, status: 'open', include_archived: false })).toBe(
            'skip=0&limit=20&status=open&include_archived=false',
        );
    });

    it('builds a JSON payload with the same fields', () => {
        expect(buildTicketsPayload({ priority: 'Высокий', category: 'IT', skip: 10 })).toEqual({
            skip: 10,
            priority: 'Высокий',
            category: 'IT',
        });
    });
});
