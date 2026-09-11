import { describe, expect, it } from 'vitest';
import type { InternalExtension } from '@entities/internal-communication';
import {
    applyCreatedInternalExtension,
    applyDeletedInternalExtension,
    applyUpdatedInternalExtension,
    editingInternalExtension,
    filterInternalExtensions,
    internalExtensionInitials,
} from './directoryList';

function row(partial: Partial<InternalExtension> & Pick<InternalExtension, 'id'>): InternalExtension {
    return {
        fullName: 'Name',
        extension: '100',
        ...partial,
    };
}

describe('filterInternalExtensions', () => {
    const rows = [
        row({ id: 2, fullName: 'Sayyora Rasuleva', extension: '21' }),
        row({ id: 1, fullName: 'Kseniya Lehnenschmidt', extension: '3' }),
        row({ id: 3, fullName: 'Reception', extension: '110' }),
    ];

    it('sorts by extension numerically', () => {
        expect(filterInternalExtensions(rows, '').map((r) => r.extension)).toEqual(['3', '21', '110']);
    });

    it('filters by name without regard to case', () => {
        expect(filterInternalExtensions(rows, '  sayyora  ').map((r) => r.id)).toEqual([2]);
    });

    it('filters by extension substring', () => {
        expect(filterInternalExtensions(rows, '11').map((r) => r.id)).toEqual([3]);
    });
});

describe('internalExtensionInitials', () => {
    it('uses first letters of two names', () => {
        expect(internalExtensionInitials('Sayyora Rasuleva')).toBe('SR');
    });

    it('uses two letters of a single token', () => {
        expect(internalExtensionInitials('Reception')).toBe('RE');
    });

    it('falls back for empty names', () => {
        expect(internalExtensionInitials('   ')).toBe('?');
    });
});

describe('directory list mutations', () => {
    const a = row({ id: 1, fullName: 'A', extension: '10' });
    const b = row({ id: 2, fullName: 'B', extension: '20' });

    it('appends a created contact and replaces a duplicate id', () => {
        expect(applyCreatedInternalExtension([a], b)).toEqual([a, b]);
        expect(applyCreatedInternalExtension([a], { ...a, fullName: 'A2' })).toEqual([{ ...a, fullName: 'A2' }]);
    });

    it('replaces a patched contact by id', () => {
        const updated = { ...b, fullName: 'B2', extension: '22' };
        expect(applyUpdatedInternalExtension([a, b], updated)).toEqual([a, updated]);
    });

    it('removes a deleted contact', () => {
        expect(applyDeletedInternalExtension([a, b], 1)).toEqual([b]);
    });
});

describe('editingInternalExtension', () => {
    it('narrows create vs edit without comparing the row to a string', () => {
        expect(editingInternalExtension('new')).toBeNull();
        expect(editingInternalExtension(null)).toBeNull();
        const current = row({ id: 9, fullName: 'Edit me', extension: '9' });
        expect(editingInternalExtension(current)).toBe(current);
    });
});
