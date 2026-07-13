import { describe, expect, it } from 'vitest';
import type { DuplicateTimeEntryGroup, DuplicateTimeEntryRow } from '@entities/time-tracking/api/projectDuplicateEntries';
import { buildDefaultArchiveSelection, duplicateEntryKey, splitDuplicateGroupsByWorkDate } from './projectDuplicateGroups';

function entry(partial: Partial<DuplicateTimeEntryRow> & Pick<DuplicateTimeEntryRow, 'entry_id' | 'work_date'>): DuplicateTimeEntryRow {
    return {
        auth_user_id: 1,
        user_name: 'User',
        task_name: 'Task',
        description: 'Note',
        hours: 1,
        rounded_hours: 1,
        is_billable: false,
        billable_amount: 0,
        currency: 'USD',
        created_at: partial.created_at ?? '2026-06-01T10:00:00Z',
        ...partial,
    };
}

function group(entries: DuplicateTimeEntryRow[]): DuplicateTimeEntryGroup {
    return {
        group_id: 'g1',
        group_label: 'DUP-0001',
        auth_user_id: 1,
        user_name: 'User',
        work_date: entries[0]?.work_date ?? '2026-06-01',
        task_name: 'Task',
        description: 'Note',
        rounded_hours: 1,
        billable_amount: 0,
        currency: 'USD',
        entries_in_group: entries.length,
        entries,
    };
}

describe('splitDuplicateGroupsByWorkDate', () => {
    it('keeps entries with different created_at in one group when work_date matches', () => {
        const input = [group([
            entry({ entry_id: 'a', work_date: '2025-10-28', created_at: '2026-06-09T16:09:18Z' }),
            entry({ entry_id: 'b', work_date: '2025-10-28', created_at: '2026-06-19T13:42:10Z' }),
            entry({ entry_id: 'c', work_date: '2025-10-28', created_at: '2026-06-19T16:40:12Z' }),
        ])];
        const out = splitDuplicateGroupsByWorkDate(input);
        expect(out).toHaveLength(1);
        expect(out[0].entries.map((e) => e.entry_id)).toEqual(['a', 'b', 'c']);
    });

    it('splits mixed work dates into separate duplicate groups', () => {
        const input = [group([
            entry({ entry_id: 'a', work_date: '2026-06-09', created_at: '2026-06-09T10:00:00Z' }),
            entry({ entry_id: 'b', work_date: '2026-06-19', created_at: '2026-06-19T10:00:00Z' }),
            entry({ entry_id: 'c', work_date: '2026-06-19', created_at: '2026-06-19T11:00:00Z' }),
        ])];
        const out = splitDuplicateGroupsByWorkDate(input);
        expect(out).toHaveLength(1);
        expect(out[0].work_date).toBe('2026-06-19');
        expect(out[0].entries.map((e) => e.entry_id)).toEqual(['b', 'c']);
    });

    it('keeps single-date groups unchanged', () => {
        const input = [group([
            entry({ entry_id: 'a', work_date: '2026-06-01' }),
            entry({ entry_id: 'b', work_date: '2026-06-01' }),
        ])];
        expect(splitDuplicateGroupsByWorkDate(input)).toHaveLength(1);
    });
});

describe('buildDefaultArchiveSelection', () => {
    it('keeps the earliest created entry in each group', () => {
        const groups = splitDuplicateGroupsByWorkDate([group([
            entry({ entry_id: 'a', work_date: '2026-06-19', created_at: '2026-06-19T10:00:00Z' }),
            entry({ entry_id: 'b', work_date: '2026-06-19', created_at: '2026-06-19T11:00:00Z' }),
        ])]);
        const selected = buildDefaultArchiveSelection(groups);
        expect(selected.has(duplicateEntryKey(entry({ entry_id: 'a', work_date: '2026-06-19' })))).toBe(false);
        expect(selected.has(duplicateEntryKey(entry({ entry_id: 'b', work_date: '2026-06-19' })))).toBe(true);
    });
});
