import { describe, expect, it } from 'vitest';
import {
    buildTimePreviewDuplicateRowKeySet,
    deduplicateTimeExcelPreviewRows,
    timePreviewRowDuplicateFingerprint,
} from './reportPreviewDuplicateRows';
import type { TimeExcelPreviewRow } from './previewExcelTypes';

function row(partial: Partial<TimeExcelPreviewRow> & Pick<TimeExcelPreviewRow, 'rowKey' | 'workDate'>): TimeExcelPreviewRow {
    return {
        rowKey: partial.rowKey,
        timeEntryId: partial.timeEntryId ?? partial.rowKey,
        rowKind: partial.rowKind ?? 'entry',
        sourceEntryCount: 1,
        userName: partial.userName ?? 'Alice',
        employeeName: partial.employeeName ?? 'Alice',
        authUserId: partial.authUserId ?? 1,
        employeeInitials: '',
        employeePosition: '',
        workDate: partial.workDate,
        recordedAt: partial.recordedAt ?? `${partial.workDate}T10:00:00Z`,
        clientId: '',
        clientName: '',
        projectId: partial.projectId ?? 'p1',
        projectName: 'Project',
        projectCode: '',
        taskId: partial.taskId ?? 't1',
        taskName: partial.taskName ?? 'Task',
        note: partial.note ?? 'Same note',
        description: partial.description ?? partial.note ?? 'Same note',
        hours: partial.hours ?? 1,
        billableHours: partial.billableHours ?? partial.hours ?? 1,
        isBillable: true,
        taskBillableByDefault: false,
        isInvoiced: false,
        isPaid: false,
        isWeekSubmitted: false,
        billableRate: 100,
        amountToPay: partial.amountToPay ?? 100,
        costRate: 0,
        costAmount: 0,
        currency: partial.currency ?? 'USD',
        externalReferenceUrl: '',
        invoiceId: '',
        invoiceNumber: '',
        isVoided: false,
        voidKind: null,
    };
}

describe('buildTimePreviewDuplicateRowKeySet', () => {
    it('does not flag identical task/note on different work dates', () => {
        const rows = [
            row({ rowKey: 'a', workDate: '2026-07-01' }),
            row({ rowKey: 'b', workDate: '2026-07-02' }),
        ];
        expect(buildTimePreviewDuplicateRowKeySet(rows).size).toBe(0);
    });

    it('flags rows that match regardless of recording time', () => {
        const rows = [
            row({ rowKey: 'a', workDate: '2026-02-13', recordedAt: '2026-02-13T13:42:00Z' }),
            row({ rowKey: 'b', workDate: '2026-02-13', recordedAt: '2026-02-13T16:11:00Z' }),
        ];
        const dupes = buildTimePreviewDuplicateRowKeySet(rows);
        expect(dupes.has('a')).toBe(true);
        expect(dupes.has('b')).toBe(true);
    });

    it('does not flag same-day rows when worked hours differ', () => {
        const rows = [
            row({ rowKey: 'a', workDate: '2026-07-06', hours: 1 }),
            row({ rowKey: 'b', workDate: '2026-07-06', hours: 2 }),
        ];
        expect(buildTimePreviewDuplicateRowKeySet(rows).size).toBe(0);
    });

    it('matches backend note normalization', () => {
        const a = row({ rowKey: 'a', workDate: '2026-02-12', note: '  Same   Note ' });
        const b = row({ rowKey: 'b', workDate: '2026-02-12', note: 'same note' });
        expect(timePreviewRowDuplicateFingerprint(a)).toBe(timePreviewRowDuplicateFingerprint(b));
    });

    it('matches rows by task name when task id is missing or synthetic', () => {
        const a = row({ rowKey: 'a', workDate: '2026-02-12', taskId: 'task:Document Review', taskName: 'Document Review' });
        const b = row({ rowKey: 'b', workDate: '2026-02-12', taskId: '', taskName: 'Document Review' });
        expect(timePreviewRowDuplicateFingerprint(a)).toBe(timePreviewRowDuplicateFingerprint(b));
    });
});

describe('deduplicateTimeExcelPreviewRows', () => {
    it('keeps only the earliest duplicate row', () => {
        const rows = [
            row({ rowKey: 'a', timeEntryId: 'a', workDate: '2026-02-12', recordedAt: '2026-02-12T10:00:00Z' }),
            row({ rowKey: 'b', timeEntryId: 'b', workDate: '2026-02-12', recordedAt: '2026-02-12T16:11:00Z' }),
        ];
        const out = deduplicateTimeExcelPreviewRows(rows);
        expect(out).toHaveLength(1);
        expect(out[0]?.timeEntryId).toBe('a');
    });

    it('collapses glued Document Review note with clean near-duplicate', () => {
        const rows = [
            row({
                rowKey: 'a',
                workDate: '2026-07-15',
                taskName: 'Document Review',
                note: 'Document ReviewЗаконодательство, документы и проект,',
                hours: 2.633333,
                amountToPay: 395,
            }),
            row({
                rowKey: 'b',
                workDate: '2026-07-15',
                taskName: 'Document Review',
                note: 'Законодательство, документы и проект договора на услуги',
                hours: 2.633333,
                amountToPay: 395,
            }),
        ];
        const kept = deduplicateTimeExcelPreviewRows(rows);
        expect(kept.filter((r) => r.rowKind === 'entry')).toHaveLength(1);
    });
});
