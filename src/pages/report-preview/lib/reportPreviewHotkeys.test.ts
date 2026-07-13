import { describe, expect, it } from 'vitest';
import {
    canUndo,
    clearEditHistory,
    createReportPreviewEditHistory,
    peekUndo,
    popUndo,
    pushCreateUndo,
    pushDeleteUndo,
    pushPatchUndo,
} from './reportPreviewEditHistory';
import type { TimeExcelPreviewRow } from './previewExcelTypes';
import {
    formatPrimaryShortcut,
    isPrimaryModifierPressed,
    resolveReportPreviewHotkey,
} from './reportPreviewHotkeys';

function row(partial: Partial<TimeExcelPreviewRow> & Pick<TimeExcelPreviewRow, 'rowKey'>): TimeExcelPreviewRow {
    return {
        timeEntryId: 'e1',
        rowKind: 'entry',
        sourceEntryCount: 1,
        userName: 'User',
        employeeName: 'User',
        authUserId: 1,
        employeeInitials: 'U',
        employeePosition: 'Associate',
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

describe('reportPreviewEditHistory', () => {
    it('coalesces rapid patches for the same row', () => {
        const history = createReportPreviewEditHistory();
        const beforeA = row({ rowKey: 'r1', note: 'a' });
        const beforeB = row({ rowKey: 'r1', note: 'b' });
        pushPatchUndo(history, 'r1', beforeA, 1000);
        pushPatchUndo(history, 'r1', beforeB, 1400);
        expect(history.stack).toHaveLength(1);
        const top = peekUndo(history);
        expect(top?.kind).toBe('patch');
        expect(top?.kind === 'patch' ? top.before.note : null).toBe('a');
    });

    it('keeps separate entries after coalesce window', () => {
        const history = createReportPreviewEditHistory();
        pushPatchUndo(history, 'r1', row({ rowKey: 'r1', note: 'a' }), 1000);
        pushPatchUndo(history, 'r1', row({ rowKey: 'r1', note: 'b' }), 2200);
        expect(history.stack).toHaveLength(2);
    });

    it('pops create and patch entries', () => {
        const history = createReportPreviewEditHistory();
        pushPatchUndo(history, 'r1', row({ rowKey: 'r1' }), 1000);
        pushCreateUndo(history, 'r2', 'te-2', 5, 2000);
        expect(canUndo(history)).toBe(true);
        expect(popUndo(history)?.kind).toBe('create');
        expect(popUndo(history)?.kind).toBe('patch');
        expect(canUndo(history)).toBe(false);
        clearEditHistory(history);
        expect(canUndo(history)).toBe(false);
    });

    it('stores delete snapshots for undo restore', () => {
        const history = createReportPreviewEditHistory();
        const snap = row({ rowKey: 'r-del', note: 'restore me' });
        pushDeleteUndo(history, 'r-del', snap, 3000);
        const top = peekUndo(history);
        expect(top?.kind).toBe('delete');
        expect(top?.kind === 'delete' ? top.snapshot.note : null).toBe('restore me');
        expect(popUndo(history)?.kind).toBe('delete');
        expect(canUndo(history)).toBe(false);
    });
});

describe('reportPreviewHotkeys', () => {
    it('detects primary modifier on ctrl or meta', () => {
        expect(isPrimaryModifierPressed({ ctrlKey: true, metaKey: false })).toBe(true);
        expect(isPrimaryModifierPressed({ ctrlKey: false, metaKey: true })).toBe(true);
        expect(isPrimaryModifierPressed({ ctrlKey: false, metaKey: false })).toBe(false);
    });

    it('maps undo/save/duplicate keys', () => {
        expect(resolveReportPreviewHotkey({
            key: 'z',
            ctrlKey: true,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            target: null,
        } as unknown as KeyboardEvent)).toBe('undo');
        expect(resolveReportPreviewHotkey({
            key: 's',
            ctrlKey: false,
            metaKey: true,
            altKey: false,
            shiftKey: false,
            target: null,
        } as unknown as KeyboardEvent)).toBe('save');
        expect(resolveReportPreviewHotkey({
            key: 'd',
            ctrlKey: true,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            target: null,
        } as unknown as KeyboardEvent)).toBe('duplicate');
    });

    it('formats shortcut labels', () => {
        const label = formatPrimaryShortcut('Z');
        expect(label === '⌘Z' || label === 'Ctrl+Z').toBe(true);
    });

    it('skips duplicate while typing in inputs', () => {
        const input = { tagName: 'INPUT', isContentEditable: false, closest: () => null };
        expect(resolveReportPreviewHotkey({
            key: 'd',
            ctrlKey: true,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            target: input,
        } as unknown as KeyboardEvent)).toBeNull();
        expect(resolveReportPreviewHotkey({
            key: 'z',
            ctrlKey: true,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            target: input,
        } as unknown as KeyboardEvent)).toBe('undo');
    });
});
