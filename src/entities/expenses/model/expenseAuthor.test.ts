import { describe, expect, it } from 'vitest';
import type { ExpenseRequest } from './types';
import {
    expenseAuthorSearchText,
    formatExpenseApprovedByLabel,
    formatExpenseAuthorExport,
    formatExpenseAuthorLabel,
    formatExpensePaidByLabel,
    formatPartnerUserLabel,
    mergeExpenseAuthorFromCache,
    needsAuthorEnrichment,
    normalizeCreatedBy,
} from './expenseAuthor';

const req = (p: Partial<ExpenseRequest>) => ({ createdByUserId: 5, ...p } as ExpenseRequest);

describe('normalizeCreatedBy', () => {
    it('returns an empty author with the fallback id for invalid payloads', () => {
        expect(normalizeCreatedBy(null, 5)).toEqual({ id: 5, displayName: null, email: null, picture: null, position: null });
    });

    it('accepts many field name variants', () => {
        expect(normalizeCreatedBy({ id: '7', full_name: ' Ann ', mail: 'a@b', avatar_url: 'p', jobTitle: 'Lawyer' }, 5)).toEqual({
            id: 7, displayName: 'Ann', email: 'a@b', picture: 'p', position: 'Lawyer',
        });
        expect(normalizeCreatedBy({ id: 'x' }, 5).id).toBe(5);
    });
});

describe('author enrichment', () => {
    it('needs enrichment only without a name and email', () => {
        expect(needsAuthorEnrichment(req({}))).toBe(true);
        expect(needsAuthorEnrichment(req({ createdBy: { id: 5, displayName: ' ', email: null } as never }))).toBe(true);
        expect(needsAuthorEnrichment(req({ createdBy: { id: 5, displayName: 'Ann', email: null } as never }))).toBe(false);
    });

    it('fills the author from the cache', () => {
        const merged = mergeExpenseAuthorFromCache(req({}), { 5: { id: 5, displayName: 'Ann', email: 'a@b', picture: null, position: 'Lawyer' } });
        expect(merged.createdBy).toEqual({ id: 5, displayName: 'Ann', email: 'a@b', picture: null, position: 'Lawyer' });
    });

    it('returns the same request when nothing changes', () => {
        const r = req({ createdBy: { id: 5, displayName: 'Ann' } as never });
        expect(mergeExpenseAuthorFromCache(r, {})).toBe(r);
        const empty = req({});
        expect(mergeExpenseAuthorFromCache(empty, {})).toBe(empty);
    });
});

describe('labels', () => {
    it('formats the author label with fallbacks', () => {
        expect(formatExpenseAuthorLabel(req({ createdBy: { displayName: 'Ann' } as never }))).toBe('Ann');
        expect(formatExpenseAuthorLabel(req({ createdBy: { email: 'a@b' } as never }))).toBe('a@b');
        expect(formatExpenseAuthorLabel(req({}))).toBe('Пользователь #5');
        expect(formatExpenseAuthorExport(req({ createdBy: { displayName: 'Ann', email: 'a@b' } as never }))).toBe('Ann (a@b)');
    });

    it('formats paid-by, approved-by and partner labels', () => {
        expect(formatExpensePaidByLabel(req({}))).toBe('—');
        expect(formatExpensePaidByLabel(req({ paidByUserId: 3 }))).toBe('Пользователь #3');
        expect(formatExpenseApprovedByLabel(req({ approvedBy: { email: 'b@c' } as never }))).toBe('b@c');
        expect(formatExpenseApprovedByLabel(req({}))).toBe('—');
        expect(formatPartnerUserLabel(req({ partnerUser: { displayName: ' Partner ' } as never }))).toBe('Partner');
        expect(formatPartnerUserLabel(req({ partnerUserId: 0 }))).toBe('');
        expect(formatPartnerUserLabel(req({ partnerUserId: 8 }))).toBe('Пользователь #8');
    });

    it('builds lower-case search text', () => {
        const text = expenseAuthorSearchText(req({
            createdBy: { id: 5, displayName: 'Ann', email: 'A@B', position: 'Lawyer' } as never,
            partnerUser: { displayName: 'Partner' } as never,
        }));
        expect(text).toBe('ann a@b lawyer 5 5 partner');
    });
});
