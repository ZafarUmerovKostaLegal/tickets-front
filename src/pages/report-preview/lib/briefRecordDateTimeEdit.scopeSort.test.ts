import { describe, expect, it } from 'vitest';
import { sortTimePreviewRowsByScopeThenChrono } from './briefRecordDateTimeEdit';
import type { TimeExcelPreviewRow } from './previewExcelTypes';

function row(partial: Partial<TimeExcelPreviewRow> & Pick<TimeExcelPreviewRow, 'rowKey'>): TimeExcelPreviewRow {
    return {
        rowKind: 'entry',
        timeEntryId: partial.rowKey,
        authUserId: 1,
        userName: 'A',
        employeeName: 'A',
        workDate: '2026-07-01',
        recordedAt: '2026-07-01T10:00:00.000Z',
        hours: 1,
        billableHours: 1,
        isBillable: true,
        currency: 'UZS',
        amountToPay: 0,
        costAmount: 0,
        sourceEntryCount: 1,
        clientId: '',
        projectId: '',
        taskId: '',
        taskName: '',
        note: '',
        description: '',
        isVoided: false,
        ...partial,
    } as TimeExcelPreviewRow;
}

describe('sortTimePreviewRowsByScopeThenChrono', () => {
    it('groups same scope colors together and keeps uncolored last', () => {
        const rows = [
            row({ rowKey: '1', workDate: '2026-07-01', recordedAt: '2026-07-01T09:00:00.000Z', scopeColor: '' }),
            row({ rowKey: '2', workDate: '2026-07-02', recordedAt: '2026-07-02T09:00:00.000Z', scopeColor: '#F4CCCC' }),
            row({ rowKey: '3', workDate: '2026-07-03', recordedAt: '2026-07-03T09:00:00.000Z', scopeColor: '#FFF2CC' }),
            row({ rowKey: '4', workDate: '2026-07-04', recordedAt: '2026-07-04T09:00:00.000Z', scopeColor: '#F4CCCC' }),
            row({ rowKey: '5', workDate: '2026-07-05', recordedAt: '2026-07-05T09:00:00.000Z', scopeColor: '' }),
        ];
        const sorted = sortTimePreviewRowsByScopeThenChrono(rows, 'asc').map((r) => r.rowKey);
        expect(sorted).toEqual(['2', '4', '3', '1', '5']);
    });

    it('keeps chronological order inside a color group', () => {
        const rows = [
            row({ rowKey: 'b', workDate: '2026-07-03', recordedAt: '2026-07-03T09:00:00.000Z', scopeColor: '#CFE2F3' }),
            row({ rowKey: 'a', workDate: '2026-07-01', recordedAt: '2026-07-01T09:00:00.000Z', scopeColor: '#CFE2F3' }),
            row({ rowKey: 'c', workDate: '2026-07-02', recordedAt: '2026-07-02T09:00:00.000Z', scopeColor: '#CFE2F3' }),
        ];
        const sorted = sortTimePreviewRowsByScopeThenChrono(rows, 'asc').map((r) => r.rowKey);
        expect(sorted).toEqual(['a', 'c', 'b']);
    });
});
