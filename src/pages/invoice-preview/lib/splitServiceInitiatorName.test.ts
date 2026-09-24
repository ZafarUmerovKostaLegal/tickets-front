import { describe, expect, it } from 'vitest';
import { joinServiceInitiatorName, splitServiceInitiatorName } from './splitServiceInitiatorName';

describe('splitServiceInitiatorName', () => {
    it('keeps the note and takes the name after the last slash', () => {
        expect(splitServiceInitiatorName('Review of the claim / Acme LLC')).toEqual({
            note: 'Review of the claim',
            name: 'Acme LLC',
        });
    });

    it('leaves a slash inside the note when the name is appended last', () => {
        expect(splitServiceInitiatorName('A/B transfer / John Smith')).toEqual({
            note: 'A/B transfer',
            name: 'John Smith',
        });
    });

    it('returns the whole note when there is no name', () => {
        expect(splitServiceInitiatorName('Increased Costs Claim')).toEqual({
            note: 'Increased Costs Claim',
            name: '',
        });
        expect(splitServiceInitiatorName('Note /')).toEqual({
            note: 'Note /',
            name: '',
        });
    });
});

describe('joinServiceInitiatorName', () => {
    it('writes the name back after a slash', () => {
        expect(joinServiceInitiatorName('Review of the claim', 'Acme LLC')).toBe('Review of the claim / Acme LLC');
    });

    it('drops the slash when the name is cleared', () => {
        expect(joinServiceInitiatorName('Review of the claim', '  ')).toBe('Review of the claim');
    });
});
