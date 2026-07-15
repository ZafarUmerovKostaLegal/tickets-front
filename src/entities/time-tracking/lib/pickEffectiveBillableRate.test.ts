import { describe, expect, it } from 'vitest';
import { pickEffectiveBillableRateForProject } from './pickEffectiveBillableRate';
import type { HourlyRateRow } from '../api';

function rate(partial: Partial<HourlyRateRow> & { id: string; amount: number }): HourlyRateRow {
    return {
        auth_user_id: 1,
        rate_kind: 'billable',
        currency: 'USD',
        valid_from: null,
        valid_to: null,
        project_id: null,
        created_at: '',
        updated_at: null,
        ...partial,
    } as HourlyRateRow;
}

describe('pickEffectiveBillableRateForProject', () => {
    it('prefers current project interval over older closed one', () => {
        const rows = [
            rate({ id: 'old', amount: 100, project_id: 'p1', valid_from: null, valid_to: '2026-06-30' }),
            rate({ id: 'new', amount: 150, project_id: 'p1', valid_from: '2026-07-01', valid_to: null }),
            rate({ id: 'global', amount: 80, project_id: null }),
        ];
        const pick = pickEffectiveBillableRateForProject(rows, 'p1', 'USD', new Date('2026-07-10T12:00:00Z'));
        expect(pick?.source).toBe('project');
        expect(pick?.row.id).toBe('new');
        expect(Number(pick?.row.amount)).toBe(150);
    });

    it('falls back to global when no project override', () => {
        const rows = [
            rate({ id: 'global', amount: 90, project_id: null }),
            rate({ id: 'other', amount: 200, project_id: 'other' }),
        ];
        const pick = pickEffectiveBillableRateForProject(rows, 'p1', 'USD', new Date('2026-07-10T12:00:00Z'));
        expect(pick?.source).toBe('global');
        expect(pick?.row.id).toBe('global');
    });

    it('returns null when no rates are available', () => {
        expect(pickEffectiveBillableRateForProject([], 'p1', 'USD', new Date('2026-07-10T12:00:00Z'))).toBeNull();
    });

    it('falls back across currency when no matching currency exists', () => {
        const rows = [rate({ id: 'eur', amount: 100, currency: 'EUR', project_id: 'p1' })];
        const pick = pickEffectiveBillableRateForProject(rows, 'p1', 'USD', new Date('2026-07-10T12:00:00Z'));
        expect(pick?.row.id).toBe('eur');
        expect(pick?.source).toBe('project');
    });

    it('uses closed project interval when asOf falls inside it', () => {
        const rows = [
            rate({ id: 'closed', amount: 110, project_id: 'p1', valid_from: '2026-01-01', valid_to: '2026-06-30' }),
            rate({ id: 'global', amount: 80, project_id: null }),
        ];
        const pick = pickEffectiveBillableRateForProject(rows, 'p1', 'USD', new Date('2026-03-15T12:00:00Z'));
        expect(pick?.source).toBe('project');
        expect(pick?.row.id).toBe('closed');
    });
});
