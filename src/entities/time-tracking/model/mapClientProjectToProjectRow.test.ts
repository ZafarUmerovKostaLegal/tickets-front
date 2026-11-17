import { describe, expect, it } from 'vitest';
import type { TimeManagerClientProjectRow, TimeManagerClientRow } from '@entities/time-tracking';
import { mapClientProjectToProjectRow } from './mapClientProjectToProjectRow';
import { ttProjectTypeLabel } from '@shared/i18n/timeTrackingLabelHelpers';

const client = { id: 'c1', name: 'ООО Альфа' } as TimeManagerClientRow;

function project(partial: Partial<TimeManagerClientProjectRow>): TimeManagerClientProjectRow {
    return {
        id: 'p1',
        client_id: 'c1',
        name: 'Проект',
        project_type: 'time_and_materials',
        currency: 'USD',
        ...partial,
    } as TimeManagerClientProjectRow;
}

describe('mapClientProjectToProjectRow', () => {
    it('maps every backend project type to its UI value', () => {
        expect(mapClientProjectToProjectRow(project({ project_type: 'fixed_fee', budget_amount: 1000 } as never), client).type).toBe('Фиксированная ставка');
        expect(mapClientProjectToProjectRow(project({ project_type: 'hour_package' } as never), client).type).toBe('Пакет часов');
        expect(mapClientProjectToProjectRow(project({ project_type: 'non_billable' } as never), client).type).toBe('Не оплачиваемый');
        expect(mapClientProjectToProjectRow(project({ project_type: 'no_budget' } as never), client).type).toBe('Без бюджета');
        expect(mapClientProjectToProjectRow(project({ project_type: 'something' } as never), client).type).toBe('Время и материалы');
    });

    it('takes the client name and id from the client row', () => {
        const row = mapClientProjectToProjectRow(project({}), client);
        expect(row.client).toBe('ООО Альфа');
        expect(row.clientId).toBe('c1');
    });

    it('has no budget for "no_budget" projects', () => {
        const row = mapClientProjectToProjectRow(project({ project_type: 'no_budget' } as never), client);
        expect(row.budget).toBeUndefined();
    });

    it('uses the fixed fee amount as the budget of fixed fee projects', () => {
        const row = mapClientProjectToProjectRow(project({ project_type: 'fixed_fee', fixed_fee_amount: '2500' } as never), client);
        expect(row.budget).toBe(2500);
    });

    it('marks projects with a past end date as archived', () => {
        const row = mapClientProjectToProjectRow(project({ end_date: '2000-01-01' } as never), client);
        expect(row.status).toBe('archived');
    });
});

describe('ttProjectTypeLabel', () => {
    const translations: Record<string, string> = {
        'timeTrackingPage.projects.modal.projectTypes.noBudget': 'No budget',
        'timeTrackingPage.projects.modal.projectTypes.nonBillable': 'Non-billable',
    };
    const t = ((key: string) => translations[key] ?? key) as never;
    const untranslated = ((key: string) => key) as never;

    it('keeps "Без бюджета" and "Не оплачиваемый" as different types', () => {
        expect(ttProjectTypeLabel('Без бюджета', t)).toBe('No budget');
        expect(ttProjectTypeLabel('no_budget', t)).toBe('No budget');
        expect(ttProjectTypeLabel('Не оплачиваемый', t)).toBe('Non-billable');
        expect(ttProjectTypeLabel('non-billable', t)).toBe('Non-billable');
    });

    it('falls back to Russian labels when a translation is missing', () => {
        expect(ttProjectTypeLabel('no_budget', untranslated)).toBe('Без бюджета');
        expect(ttProjectTypeLabel('non_billable', untranslated)).toBe('Не оплачиваемый');
        expect(ttProjectTypeLabel('hourly', untranslated)).toBe('Предельное вознаграждение');
        expect(ttProjectTypeLabel('', untranslated)).toBe('');
        expect(ttProjectTypeLabel('Неизвестный', untranslated)).toBe('Неизвестный');
    });
});
