import { describe, expect, it } from 'vitest';
import {
    EMPTY_MONITOR_SPECS,
    formatMonitorDescription,
    isMonitorCategory,
    parseMonitorDescription,
} from './monitorSpecs';

describe('monitorSpecs', () => {
    it('detects monitor category', () => {
        expect(isMonitorCategory('Мониторы')).toBe(true);
        expect(isMonitorCategory('монитор')).toBe(true);
        expect(isMonitorCategory('Ноутбуки')).toBe(false);
    });

    it('round-trips structured block', () => {
        const specs = {
            ...EMPTY_MONITOR_SPECS,
            diagonalIn: '27',
            resolution: '2560×1440',
            refreshHz: '144',
            panel: 'IPS' as const,
            ports: ['HDMI', 'DisplayPort'],
            vesa: 'yes' as const,
            curved: 'no' as const,
        };
        const encoded = formatMonitorDescription(specs, 'Dell U2720Q');
        const parsed = parseMonitorDescription(encoded);
        expect(parsed.hasBlock).toBe(true);
        expect(parsed.specs.diagonalIn).toBe('27');
        expect(parsed.specs.resolution).toBe('2560×1440');
        expect(parsed.specs.refreshHz).toBe('144');
        expect(parsed.specs.panel).toBe('IPS');
        expect(parsed.specs.ports).toEqual(['HDMI', 'DisplayPort']);
        expect(parsed.specs.vesa).toBe('yes');
        expect(parsed.specs.curved).toBe('no');
        expect(parsed.notes).toBe('Dell U2720Q');
    });
});
