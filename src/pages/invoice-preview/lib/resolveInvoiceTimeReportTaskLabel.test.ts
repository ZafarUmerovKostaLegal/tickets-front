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

    it('uses the task name stored on the entry, not a prefix of the note', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e4',
                auth_user_id: 1,
                work_date: '2026-09-04',
                hours: 1.15,
                is_billable: true,
                created_at: '2026-09-04',
                task_id: 'task-1',
                description: 'Drafting the draft LLA issues list',
            }),
            invoiceLineDescription: 'Drafting the draft LLA issues list',
            taskNameById,
            storedTaskName: 'LLA advice',
        });
        expect(label).toBe('LLA advice');
    });

    it('does not invent a task from the note when task_id is set', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e5',
                auth_user_id: 1,
                work_date: '2026-09-04',
                hours: 1,
                is_billable: true,
                created_at: '2026-09-04',
                task_id: 'missing-task',
                description: 'Telephone calls with Masdar team',
            }),
            invoiceLineDescription: 'Telephone calls with Masdar team',
            taskNameById,
        });
        expect(label).toBe('');
    });

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

    it('keeps Telephone calls when the note is Attending CP call', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e2',
                auth_user_id: 1,
                work_date: '2026-09-21',
                hours: 0.75,
                is_billable: true,
                created_at: '2026-09-21',
                task_id: 'task-calls',
                description: 'Attending CP call.',
            }),
            invoiceLineDescription: 'Attending CP call.',
            taskNameById: buildProjectTaskNameByIdMap([
                {
                    id: 'task-calls',
                    project_id: 'proj-1',
                    name: 'Telephone calls',
                    default_billable_rate: null,
                    billable_by_default: true,
                    billing_mode: 'hourly',
                    flat_fee_amount: null,
                    flat_fee_currency: null,
                    created_at: '2026-01-01',
                    updated_at: null,
                },
            ]),
        });
        expect(label).toBe('Telephone calls');
    });

    it('does not use the note as the task when no task is linked', () => {
        const label = resolveInvoiceTimeReportTaskLabel({
            entry: entry({
                id: 'e3',
                auth_user_id: 1,
                work_date: '2026-09-21',
                hours: 0.75,
                is_billable: true,
                created_at: '2026-09-21',
                description: 'Attending CP call.',
            }),
            invoiceLineDescription: 'Attending CP call.',
            taskNameById,
        });
        expect(label).toBe('');
    });
});
