import { describe, expect, it } from 'vitest';
import { parseInternalExtension, parseInternalExtensionList } from './parseInternalExtension';

describe('parseInternalExtension', () => {
    it('reads snake_case and camelCase', () => {
        expect(parseInternalExtension({ id: 5, full_name: '  Reception ', extension: ' 11 ' })).toEqual({
            id: 5,
            fullName: 'Reception',
            extension: '11',
        });
        expect(parseInternalExtension({ id: '6', fullName: 'IT', extension: '22' })).toEqual({
            id: 6,
            fullName: 'IT',
            extension: '22',
        });
    });

    it('drops invalid rows', () => {
        expect(parseInternalExtension(null)).toBeNull();
        expect(parseInternalExtension({ id: 0, fullName: 'X', extension: '1' })).toBeNull();
        expect(parseInternalExtension({ fullName: 'X', extension: '1' })).toBeNull();
    });
});

describe('parseInternalExtensionList', () => {
    it('returns an empty list for a non-array payload', () => {
        expect(parseInternalExtensionList({ items: [] })).toEqual([]);
    });

    it('skips junk entries', () => {
        expect(parseInternalExtensionList([
            { id: 1, fullName: 'A', extension: '1' },
            null,
            { id: 'bad' },
        ])).toEqual([{ id: 1, fullName: 'A', extension: '1' }]);
    });
});
