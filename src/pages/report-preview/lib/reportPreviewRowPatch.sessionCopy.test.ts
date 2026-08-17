import { describe, expect, it } from 'vitest';
import { applyTimePreviewRowPatch } from './reportPreviewRowPatch';
import type { TimeExcelPreviewRow } from './previewExcelTypes';

function row(partial: Partial<TimeExcelPreviewRow> = {}): TimeExcelPreviewRow {
    return {
        rowKey: 'e-1',
        timeEntryId: '1',
        rowKind: 'entry',
        sourceEntryCount: 1,
        userName: 'Test',
        employeeName: 'Test',
        authUserId: 1,
        employeeInitials: 'T',
        employeePosition: '',
        workDate: '2026-08-01',
        recordedAt: '2026-08-01T10:00:00Z',
        clientId: 'c1',
        clientName: 'Client',
        projectId: 'p1',
        projectName: 'Project',
        projectCode: 'P1',
        taskId: 't1',
        taskName: 'Task',
        note: '',
        description: '',
        hours: 1,
        billableHours: 1,
        isBillable: true,
        taskBillableByDefault: true,
        isInvoiced: false,
        isPaid: false,
        isWeekSubmitted: false,
        billableRate: 100,
        amountToPay: 100,
        costRate: 0,
        costAmount: 0,
        currency: 'USD',
        externalReferenceUrl: '',
        invoiceId: '',
        invoiceNumber: '',
        isVoided: false,
        voidKind: null,
        isSessionCopy: true,
        ...partial,
    };
}

describe('applyTimePreviewRowPatch session copy badge', () => {
    it('clears isSessionCopy after a content edit', () => {
        const next = applyTimePreviewRowPatch(row(), { note: 'changed' }, []);
        expect(next.isSessionCopy).toBe(false);
        expect(next.note).toBe('changed');
    });

    it('keeps isSessionCopy when only scopeColor changes', () => {
        const next = applyTimePreviewRowPatch(row(), { scopeColor: '#ff0000' }, []);
        expect(next.isSessionCopy).toBe(true);
        expect(next.scopeColor).toBe('#ff0000');
    });
});
