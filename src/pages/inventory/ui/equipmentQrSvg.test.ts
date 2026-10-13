import { describe, expect, it } from 'vitest';
import { equipmentQrSvg } from './equipmentQrSvg';

describe('equipmentQrSvg', () => {
    it('builds a square vector mark', () => {
        const svg = equipmentQrSvg('https://tickets.kostalegal.com/inventory/tag/KL-EQ-0001');
        expect(svg.startsWith('<svg ')).toBe(true);
        expect(svg).toContain('shape-rendering="crispEdges"');
        expect(svg).not.toContain('<script');
    });
});