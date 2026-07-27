import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntryRow, TimeManagerClientTaskRow } from '@entities/time-tracking';
import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
import type { ProjectOption } from './timesheetProjectLoader';
import type { TimeEntry } from './TimesheetEntryModal';
import {
    DEFAULT_WEEKLY_CAP_HOURS,
    addSeconds,
    applyTimerSnapshotToEntries,
    buildDescription,
    cloneEntryForDate,
    copyTextToClipboard,
    draftEntryFromOutlookEvent,
    elapsedMsToSeconds,
    formatTimeEntryDescriptionForClipboard,
    hashToColor,
    hoursToDurationSeconds,
    isDraftTimeEntryId,
    mapProjectTasksToOptions,
    mapTimeEntryRowToUi,
    parseDescription,
    parseTimerPayload,
    readRunningTimerFromStorage,
    timerStorageKey,
    uniqEntriesById,
    weeklyCapHoursFromProfile,
    withHours,
    type TimerPersistPayload,
} from './timesheetEntryModel';

function entry(partial: Partial<TimeEntry> = {}): TimeEntry {
    return {
        id: 'entry-1',
        date: '2026-07-27',
        project: 'Project',
        client: 'Client',
        task: 'Task',
        notes: ' Notes ',
        hours: 1,
        durationSeconds: 3600,
        billable: true,
        color: '#123456',
        ...partial,
    };
}

afterEach(() => vi.unstubAllGlobals());

describe('timesheetEntryModel', () => {
    it('copies non-empty text through the Clipboard API', async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        expect(await copyTextToClipboard('  useful text  ')).toBe(true);
        expect(writeText).toHaveBeenCalledWith('  useful text  ');
        expect(await copyTextToClipboard('   ')).toBe(false);
    });

    it('normalizes descriptions, caps and duration values', () => {
        expect(formatTimeEntryDescriptionForClipboard(entry())).toBe('Notes');
        expect(parseDescription(null)).toEqual({ task: '', notes: '' });
        expect(parseDescription(' Task\n details ')).toEqual({ task: 'Task', notes: 'details' });
        expect(parseDescription('Task')).toEqual({ task: 'Task', notes: '' });
        expect(buildDescription(' Task ', ' Notes ')).toBe('Task\nNotes');
        expect(buildDescription('', 'Notes')).toBe('Notes');
        expect(buildDescription('', '')).toBeNull();
        expect(weeklyCapHoursFromProfile('37,5')).toBe(37.5);
        expect(weeklyCapHoursFromProfile(500)).toBe(168);
        expect(weeklyCapHoursFromProfile(0)).toBe(DEFAULT_WEEKLY_CAP_HOURS);
        expect(hoursToDurationSeconds(1.25)).toBe(4500);
        expect(hoursToDurationSeconds(Number.NaN)).toBe(0);
        expect(elapsedMsToSeconds(2999)).toBe(2);
        expect(elapsedMsToSeconds(-1)).toBe(0);
    });

    it('maps tasks and API time rows without losing money metadata', () => {
        const tasks = [
            { id: 't1', name: 'Research', billable_by_default: true },
            { id: 't2', name: '', billable_by_default: false },
        ] as TimeManagerClientTaskRow[];
        expect(mapProjectTasksToOptions(tasks)).toEqual([
            { id: 't1', name: 'Research', billableByDefault: true },
        ]);

        const project: ProjectOption = {
            id: 'p1', name: 'Matter', client: 'Acme', clientId: 'c1', color: '#abcdef',
            currency: 'USD', recordsLanguage: 'ENG',
        };
        const row = {
            id: 'server-1', auth_user_id: 7, work_date: '2026-07-27', hours: '1.5',
            duration_seconds: 5400, is_billable: true, project_id: 'p1', task_id: 't1',
            description: 'Research\nCase notes', created_at: '2026-07-27T00:00:00Z', updated_at: null,
            billable_amount: '125,50', billable_currency: 'EUR', rate_source_amount: '100',
            rate_source_currency: 'USD', fx_rate_date: '2026-07-27', fx_rate_source: 'CBU',
            is_voided: true, void_kind: 'reallocated',
        } as TimeEntryRow;
        const mapped = mapTimeEntryRowToUi(row, new Map([['p1', project]]));
        expect(mapped).toMatchObject({
            id: 'server-1', project: 'Matter', client: 'Acme', task: 'Research', notes: 'Case notes',
            hours: 1.5, durationSeconds: 5400, billableAmount: 125.5,
            billableCurrency: 'EUR', isVoided: true, voidKind: 'reallocated',
        });
        expect(isDraftTimeEntryId(mapped.id)).toBe(false);
        expect(isDraftTimeEntryId('te_new')).toBe(true);
        expect(hashToColor('p1')).toMatch(/^hsl\(\d+ 52% 40%\)$/);
    });

    it('creates and clones drafts with safe timer values', () => {
        const outlook = {
            id: 'outlook-1', subject: 'Client call',
            start: { dateTime: '2026-07-27T10:00:00' },
            end: { dateTime: '2026-07-27T11:30:00' },
        } satisfies CalendarEvent;
        const draft = draftEntryFromOutlookEvent(outlook, new Date(2026, 6, 27));
        expect(draft).toMatchObject({ hours: 1.5, durationSeconds: 5400, billable: true });
        expect(draft.id).toBe('te_outlook_outlook-1');

        const cloned = cloneEntryForDate(entry({ isVoided: true, billableAmount: 50 }), '2026-07-28');
        expect(cloned).toMatchObject({ date: '2026-07-28', hours: 0, durationSeconds: 0, isVoided: false });
        expect(withHours(entry(), 2.5)).toMatchObject({ hours: 2.5, durationSeconds: 9000 });
        expect(withHours(entry(), -2)).toMatchObject({ hours: 0, durationSeconds: 0 });
        expect(addSeconds(entry(), 30)).toMatchObject({ hours: 3630 / 3600, durationSeconds: 3630 });
        expect(uniqEntriesById([entry(), entry({ notes: 'duplicate' }), entry({ id: 'entry-2' })]))
            .toHaveLength(2);
    });

    it('validates persisted timers and restores only the matching user', () => {
        const payload: TimerPersistPayload = {
            v: 1, authUserId: 42, entryId: 'entry-1', startedAt: 1000,
            snapshot: entry({ hours: 2, durationSeconds: 7200 }), paused: true,
        };
        expect(parseTimerPayload(JSON.stringify(payload))).toEqual(payload);
        expect(parseTimerPayload('{broken')).toBeNull();
        expect(parseTimerPayload(JSON.stringify({ v: 2 }))).toBeNull();
        expect(timerStorageKey(42)).toContain('42');

        vi.stubGlobal('localStorage', { getItem: vi.fn(() => JSON.stringify(payload)) });
        expect(readRunningTimerFromStorage(42)).toEqual({ entryId: 'entry-1', startedAt: 1000, paused: true });
        expect(readRunningTimerFromStorage(41)).toBeNull();

        const original = [entry({ durationSeconds: 0, hours: 0 }), entry({ id: 'entry-2' })];
        const restored = applyTimerSnapshotToEntries(original, payload);
        expect(restored[0]).toMatchObject({ durationSeconds: 7200, hours: 2 });
        expect(applyTimerSnapshotToEntries(restored, payload)).toBe(restored);
    });
});
