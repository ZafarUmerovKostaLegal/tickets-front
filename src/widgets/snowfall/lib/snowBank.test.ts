import { describe, expect, it } from 'vitest';
import { bankHeightAt, createBank, depositSnow, resizeBank, stepBank } from './snowBank';

function grownBank(width = 400, max = 20) {
    const b = createBank(max);
    resizeBank(b, width);
    for (let i = 0; i < 400; i += 1) stepBank(b, 0.1);
    return b;
}

describe('snowBank', () => {
    it('starts empty and sized to the viewport', () => {
        const b = createBank(20);
        resizeBank(b, 400);
        expect(b.h.length).toBe(101);
        expect(bankHeightAt(b, 100)).toBe(0);
        expect(bankHeightAt(b, -10)).toBe(0);
        expect(bankHeightAt(b, 10_000)).toBe(0);
    });

    it('grows into dunes that stay within the maximum height', () => {
        const b = grownBank();
        const heights = Array.from(b.h);
        expect(Math.max(...heights)).toBeLessThanOrEqual(20 * 1.15);
        expect(Math.min(...heights)).toBeGreaterThan(0);
        expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1);
    });

    it('keeps the surface smooth enough (slope relaxation)', () => {
        const b = grownBank();
        for (let i = 0; i < b.h.length - 1; i += 1)
            expect(Math.abs(b.h[i]! - b.h[i + 1]!)).toBeLessThan(2);
    });

    it('piles landed flakes around the landing point', () => {
        const b = createBank(20);
        resizeBank(b, 400);
        depositSnow(b, 200, 4);
        expect(bankHeightAt(b, 200)).toBe(4);
        expect(bankHeightAt(b, 204)).toBeCloseTo(2.2);
        expect(bankHeightAt(b, 220)).toBe(0);
        for (let i = 0; i < 20; i += 1) depositSnow(b, 200, 10);
        expect(bankHeightAt(b, 200)).toBeLessThanOrEqual(23);
    });

    it('keeps its heights when the viewport is resized', () => {
        const b = grownBank(400);
        const before = bankHeightAt(b, 200);
        resizeBank(b, 800);
        expect(b.h.length).toBe(201);
        expect(bankHeightAt(b, 400)).toBeCloseTo(before, 0);
    });
});
