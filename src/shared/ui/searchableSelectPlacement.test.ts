import { describe, expect, it } from 'vitest';
import { computePortalDropdownBox } from './searchableSelectPlacement';

const viewport = { width: 1280, height: 800 };

describe('computePortalDropdownBox', () => {
    it('opens upward when the trigger sits above a footer dock', () => {
        const box = computePortalDropdownBox(
            { top: 720, bottom: 748, left: 40, width: 180 },
            viewport,
            { obstacleBottom: 752, minWidth: 220 },
        );
        expect(box.bottom).toBeGreaterThan(0);
        expect(box.top).toBeUndefined();
        expect(box.maxH).toBeGreaterThan(200);
    });

    it('opens downward when there is room below', () => {
        const box = computePortalDropdownBox(
            { top: 500, bottom: 528, left: 40, width: 180 },
            viewport,
            { minWidth: 220 },
        );
        expect(box.top).toBeGreaterThan(528);
        expect(box.bottom).toBeUndefined();
        expect(box.maxH).toBeGreaterThan(200);
    });

    it('opens downward when there is room below in the upper half', () => {
        const box = computePortalDropdownBox(
            { top: 80, bottom: 108, left: 40, width: 180 },
            viewport,
            { minWidth: 220 },
        );
        expect(box.top).toBeGreaterThan(108);
        expect(box.bottom).toBeUndefined();
        expect(box.maxH).toBeGreaterThan(200);
    });
});
