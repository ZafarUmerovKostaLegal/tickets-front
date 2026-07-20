import { describe, expect, it } from 'vitest';
import type { TimeEntryRow } from '@entities/time-tracking';
import {
    buildProjectTaskNameByIdMap,
    resolveInvoiceTimeReportTaskLabel,
} from './resolveInvoiceTimeReportTaskLabel';

function entry(partial: Partial<TimeEntryRow> & Pick<TimeEntryRow, 'id' | 'auth_user_id' | 'work_date' | 'hours' | 'is_billable' | 'created_at'>): TimeEntryRow {
    return {
        project_id: null,
        task_id: null,
        description: null,
        updated_at: null,
        ...partial,
    };
}

describe('resolveInvoiceTimeReportTaskLabel', () => {
    const taskNameById = buildProjectTaskNameByIdMap([
        {
            id: 'task-1',
            project_id: 'proj-1',
            name: 'Document Review',
            default_billable_rate: null,
            billable_by_default: true,
            billing_mode: 'hourly',
            flat_fee_amount: null,
            flat_fee_currency: null,
            created_at: '2026-01-01',
            updated_at: null,
        },
    ]);

    it('prefers project task name from task_id', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e1',
                auth_user_id: 1,
                work_date: '2026-06-08',
                hours: 1,
                is_billable: true,
                created_at: '2026-06-08',
                task_id: 'task-1',
                description: 'Законодательство и договор',
            }),
            invoiceLineDescription: 'Законодательство и договор',
            taskNameById,
        });
        expect(label).toBe('Document Review');
    });

    it('uses Task\\nNotes storage when task_id is missing', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e2',
                auth_user_id: 1,
                work_date: '2026-06-08',
                hours: 1,
                is_billable: true,
                created_at: '2026-06-08',
                description: 'Drafting\nПроект договора',
            }),
            invoiceLineDescription: 'Проект договора',
            taskNameById,
        });
        expect(label).toBe('Drafting');
    });

    it('detects glued known task prefix in raw description', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e3',
                auth_user_id: 1,
                work_date: '2026-06-08',
                hours: 1,
                is_billable: true,
                created_at: '2026-06-08',
                description: 'ResearchЗаконодательство, документы',
            }),
            invoiceLineDescription: 'Законодательство, документы',
            taskNameById,
        });
        expect(label).toBe('Research');
    });
});
