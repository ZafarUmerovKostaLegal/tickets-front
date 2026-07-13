import { describe, expect, it } from 'vitest';
import type { TimeExcelPreviewRow } from './previewExcelTypes';
import { buildReportPreviewPositionShare } from './reportPreviewPositionShare';

function row(partial: Partial<TimeExcelPreviewRow> & Pick<TimeExcelPreviewRow, 'rowKey'>): TimeExcelPreviewRow {
    return {
        timeEntryId: 'e1',
        rowKind: 'entry',
        sourceEntryCount: 1,
        userName: 'User',
        employeeName: 'User',
        authUserId: 1,
        employeeInitials: 'U',
        employeePosition: '',
        workDate: '2026-06-01',
        recordedAt: '2026-06-01T10:00:00Z',
        clientId: 'c1',
        clientName: 'Client',
        projectId: 'p1',
        projectName: 'Project',
        projectCode: '',
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
        currency: 'UZS',
        externalReferenceUrl: '',
        invoiceId: '',
        invoiceNumber: '',
        isVoided: false,
        voidKind: null,
        ...partial,
    };
}

describe('buildReportPreviewPositionShare', () => {
    it('groups billable hours by position and computes percent share', () => {
        const shares = buildReportPreviewPositionShare([
            row({ rowKey: 'a', employeePosition: 'Partner', billableHours: 2 }),
            row({ rowKey: 'b', employeePosition: 'Associate', billableHours: 2 }),
            row({ rowKey: 'c', employeePosition: 'Associate', billableHours: 1 }),
        ]);
        expect(shares).toEqual([
            { position: 'Partner', billableHours: 2, percent: 40 },
            { position: 'Associate', billableHours: 3, percent: 60 },
        ]);
    });

    it('normalizes unknown positions into a single bucket', () => {
        const shares = buildReportPreviewPositionShare([
            row({ rowKey: 'a', employeePosition: '', billableHours: 1 }),
            row({ rowKey: 'b', employeePosition: '   ', billableHours: 1 }),
        ]);
        expect(shares).toEqual([
            { position: 'Не указано', billableHours: 2, percent: 100 },
        ]);
    });

    it('returns empty list when there are no billable hours', () => {
        expect(buildReportPreviewPositionShare([
            row({ rowKey: 'a', billableHours: 0 }),
        ])).toEqual([]);
    });
});
