import { describe, expect, it } from 'vitest';
import type { TimeEntryRow } from '@entities/time-tracking';
import { isDateTimeOnlyPreviewPatch } from './briefRecordDateTimeEdit';
import { matchTaskInProjectList, mergeTimeEntryResponseIntoRow } from './reportPreviewTimeEntrySave';

describe('isDateTimeOnlyPreviewPatch', () => {
    it('accepts recordedAt and workDate patches', () => {
        expect(isDateTimeOnlyPreviewPatch({ recordedAt: '2026-07-07T10:00:00.000Z' })).toBe(true);
        expect(isDateTimeOnlyPreviewPatch({ workDate: '2026-07-07', recordedAt: '2026-07-07T10:00:00.000Z' })).toBe(true);
    });

    it('rejects other field patches', () => {
        expect(isDateTimeOnlyPreviewPatch({ note: 'x' })).toBe(false);
        expect(isDateTimeOnlyPreviewPatch({ recordedAt: '2026-07-07T10:00:00.000Z', note: 'x' })).toBe(false);
    });
});

describe('matchTaskInProjectList', () => {
    const tasks = [
        { id: 'task-a', name: 'Contract review' },
        { id: 'task-b', name: 'Due diligence' },
    ];

    it('matches by id when present in target project', () => {
        expect(matchTaskInProjectList(tasks, 'task-b', 'Other name')).toEqual({
            taskId: 'task-b',
            taskName: 'Due diligence',
        });
    });

    it('matches by name when id differs between projects', () => {
        expect(matchTaskInProjectList(tasks, 'old-task-id', 'Contract review')).toEqual({
            taskId: 'task-a',
            taskName: 'Contract review',
        });
    });

    it('matches names case-insensitively', () => {
        expect(matchTaskInProjectList(tasks, '', '  contract REVIEW  ')).toEqual({
            taskId: 'task-a',
            taskName: 'Contract review',
        });
    });

    it('returns null when task is not found', () => {
        expect(matchTaskInProjectList(tasks, 'missing', 'Missing task')).toBeNull();
    });
});

describe('mergeTimeEntryResponseIntoRow', () => {
    it('does not fall back to created_at when recorded_at is missing in API response', () => {
        const tr = {
            id: '1',
            auth_user_id: 1,
            work_date: '2026-07-07',
            hours: 1,
            is_billable: true,
            project_id: null,
            task_id: null,
            description: null,
            created_at: '2026-06-01T08:00:00.000Z',
            updated_at: null,
        } as TimeEntryRow;
        const merged = mergeTimeEntryResponseIntoRow(tr);
        expect(merged.recordedAt).toBeUndefined();
    });

    it('uses recorded_at from API response when present', () => {
        const tr = {
            id: '1',
            auth_user_id: 1,
            work_date: '2026-07-07',
            hours: 1,
            is_billable: true,
            project_id: null,
            task_id: null,
            description: null,
            recorded_at: '2026-07-07T05:34:00.000Z',
            created_at: '2026-06-01T08:00:00.000Z',
            updated_at: null,
        } as TimeEntryRow;
        const merged = mergeTimeEntryResponseIntoRow(tr);
        expect(merged.recordedAt).toBe('2026-07-07T05:34:00.000Z');
    });
});
