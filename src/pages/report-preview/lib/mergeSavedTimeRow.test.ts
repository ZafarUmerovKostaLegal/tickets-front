import { describe, expect, it } from 'vitest';
import type { TimeExcelPreviewRow } from './previewExcelTypes';
import { mergeSavedTimeRow } from './mergeSavedTimeRow';

const row = (note: string, extra: Partial<TimeExcelPreviewRow> = {}) => ({ rowKey: 'r1', note, description: note, amountToPay: 10, ...extra }) as unknown as TimeExcelPreviewRow;

describe('mergeSavedTimeRow', () => {
    it('keeps what was typed while the save was in flight', () => {
        const sent = row('the L');
        const current = row('the LLA attached');
        const saved = row('the L', { amountToPay: 12 });
        const merged = mergeSavedTimeRow(sent, current, saved);
        expect(merged.note).toBe('the LLA attached');
        expect(merged.amountToPay).toBe(12);
    });

    it('does not eat a trailing space the server trimmed', () => {
        const sent = row('the ');
        expect(mergeSavedTimeRow(sent, sent, row('the')).note).toBe('the ');
    });

    it('keeps double spaces the server collapsed', () => {
        const sent = row('First  draft ');
        expect(mergeSavedTimeRow(sent, sent, row('First draft')).note).toBe('First  draft ');
    });

    it('takes the server value when nothing changed meanwhile', () => {
        const sent = row('draft');
        expect(mergeSavedTimeRow(sent, sent, row('Draft')).note).toBe('Draft');
    });
});
