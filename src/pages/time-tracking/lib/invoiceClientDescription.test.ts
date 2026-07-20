import { describe, expect, it } from 'vitest';
import { invoiceClientDescription } from './invoiceClientDescription';
import {
    collectConfirmedSnapshotTimeEntryIds,
    intersectPreviewTimeEntryIdsWithSnapshot,
} from './confirmedSnapshotInvoiceLines';
import type { ReportSnapshotRow } from '@entities/time-tracking';

describe('invoiceClientDescription', () => {
    it('strips Task\\nNotes storage format', () => {
        expect(invoiceClientDescription('Document Review\nЗаконодательство и договор')).toBe('Законодательство и договор');
    });

    it('strips leading known task label without newline', () => {
        expect(invoiceClientDescription('Document Review Законодательство и договор')).toBe('Законодательство и договор');
        expect(invoiceClientDescription('Drafting Проект договора')).toBe('Проект договора');
        expect(invoiceClientDescription('Telephone calls Звонок клиенту')).toBe('Звонок клиенту');
    });

    it('strips glued task label without separator', () => {
        expect(invoiceClientDescription('Document ReviewЗаконодательство, документы и проект')).toBe(
            'Законодательство, документы и проект',
        );
    });

    it('keeps plain notes unchanged', () => {
        expect(invoiceClientDescription('Законодательство и договор')).toBe('Законодательство и договор');
    });

    it('uses explicit taskName hint', () => {
        expect(invoiceClientDescription('Custom Task\nNotes here', 'Custom Task')).toBe('Notes here');
    });
});

describe('intersectPreviewTimeEntryIdsWithSnapshot', () => {
    it('filters preview ids to snapshot set and drops extras', () => {
        const r = intersectPreviewTimeEntryIdsWithSnapshot(
            ['a', 'b', 'c', 'b'],
            ['b', 'c'],
        );
        expect(r.usedSnapshotFilter).toBe(true);
        expect(r.snapshotEntryCount).toBe(2);
        expect(r.timeEntryIds).toEqual(['b', 'c']);
    });

    it('falls back to unique preview when snapshot empty', () => {
        const r = intersectPreviewTimeEntryIdsWithSnapshot(['a', 'a', 'b'], []);
        expect(r.usedSnapshotFilter).toBe(false);
        expect(r.timeEntryIds).toEqual(['a', 'b']);
    });
});

describe('collectConfirmedSnapshotTimeEntryIds', () => {
    function row(partial: Partial<ReportSnapshotRow> & { data: Record<string, unknown> }): ReportSnapshotRow {
        return {
            id: partial.id ?? 'r1',
            sortOrder: partial.sortOrder ?? 0,
            sourceType: partial.sourceType ?? 'time_entry',
            sourceId: partial.sourceId ?? 'te-1',
            data: partial.data,
            overrides: null,
            editedByUserId: null,
            editedAt: null,
        };
    }

    it('collects billable non-voided time entry ids', () => {
        const ids = collectConfirmedSnapshotTimeEntryIds([
            row({
                id: '1',
                sourceId: 'te-1',
                data: { timeEntryId: 'te-1', billableHours: 1, workDate: '2026-01-01', rowKind: 'entry' },
            }),
            row({
                id: '2',
                sourceId: 'te-2',
                data: { timeEntryId: 'te-2', billableHours: 2, workDate: '2026-01-02', isVoided: true, rowKind: 'entry' },
            }),
            row({
                id: '3',
                sourceId: 'te-3',
                data: { timeEntryId: 'te-3', billableHours: 0, workDate: '2026-01-03', rowKind: 'entry' },
            }),
            row({
                id: '4',
                sourceId: 'te-dup',
                data: { timeEntryId: 'te-1', billableHours: 1, workDate: '2026-01-01', rowKind: 'entry' },
            }),
        ]);
        expect(ids).toEqual(['te-1']);
    });
});
