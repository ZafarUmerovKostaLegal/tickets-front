import { describe, expect, it } from 'vitest';
import { mergeRegistryPartnerNotes } from './partnerNote';
import type { InvoiceRegistryRow } from './types';

function row(patch: Partial<InvoiceRegistryRow> & { id: string }): InvoiceRegistryRow {
    return { seqNo: '1', amount: '1', ...patch };
}

describe('mergeRegistryPartnerNotes', () => {
    it('copies the invoice partner note onto a system row that has none', () => {
        const notes = new Map([['inv-1', 'Shared amounts\nNur Kashkadarya Solar']]);
        const [next] = mergeRegistryPartnerNotes([row({ id: 'sys-inv-1' })], notes);
        expect(next?.partnerNote).toBe('Shared amounts\nNur Kashkadarya Solar');
    });

    it('keeps a note the registry already returned', () => {
        const notes = new Map([['inv-1', 'from invoice']]);
        const source = row({ id: 'sys-inv-1', partnerNote: 'from registry' });
        expect(mergeRegistryPartnerNotes([source], notes)[0]).toBe(source);
    });

    it('matches an explicit invoice id', () => {
        const notes = new Map([['inv-9', 'note']]);
        const [next] = mergeRegistryPartnerNotes([row({ id: 'row-1', invoiceId: 'inv-9' })], notes);
        expect(next?.partnerNote).toBe('note');
    });
});
