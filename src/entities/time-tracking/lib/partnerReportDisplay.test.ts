import { describe, expect, it } from 'vitest';
import type { PartnerReportConfirmationRequest, TimeManagerClientProjectRow } from '../api';
import {
    resolvePartnerReportClientLabel,
    resolvePartnerReportDisplayMeta,
    type PartnerReportRowDisplayMeta,
} from './partnerReportDisplay';

function row(partial: Partial<PartnerReportConfirmationRequest> = {}): PartnerReportConfirmationRequest {
    return {
        id: 'req-1',
        snapshotId: 'snap-1',
        projectId: 'proj-1',
        dateFrom: '2026-05-01',
        dateTo: '2026-06-30',
        title: 'Legal services',
        status: 'fully_confirmed',
        submittedByAuthUserId: 1,
        requiredPartnerAuthUserIds: [],
        pendingPartnerAuthUserIds: [],
        signatures: [],
        createdAt: '2026-07-09T10:00:00.000Z',
        updatedAt: null,
        ...partial,
        reviewPriority: partial.reviewPriority ?? 'green',
    };
}

const projectRows: TimeManagerClientProjectRow[] = [{
    id: 'proj-1',
    client_id: 'client-1',
    name: 'Legal services',
    code: null,
    start_date: null,
    end_date: null,
    notes: null,
    report_visibility: '',
    project_type: 'time_and_materials',
    billable_rate_type: null,
    budget_type: null,
    budget_amount: null,
    budget_hours: null,
    budget_resets_every_month: false,
    budget_includes_expenses: false,
    send_budget_alerts: false,
    budget_alert_threshold_percent: null,
    fixed_fee_amount: null,
    usage_count: 0,
    deletable: false,
    created_at: '',
    updated_at: null,
}];

const clientNamesById = new Map([['client-1', 'Nur Bukhara Solar']]);

describe('resolvePartnerReportDisplayMeta', () => {
    it('resolves client from project row when snapshot extra has only project name', () => {
        const extra = new Map<string, PartnerReportRowDisplayMeta>([
            ['proj-1', { projectName: 'Legal services', clientName: '', clientId: '' }],
        ]);
        const meta = resolvePartnerReportDisplayMeta(row(), projectRows, clientNamesById, extra);
        expect(meta.clientName).toBe('Nur Bukhara Solar');
        expect(meta.clientId).toBe('client-1');
    });

    it('uses client meta by project id when project row is missing', () => {
        const clientMetaByProjectId = new Map([
            ['proj-1', { clientId: 'client-1', clientName: 'Nur Bukhara Solar' }],
        ]);
        const meta = resolvePartnerReportDisplayMeta(row(), [], clientNamesById, undefined, clientMetaByProjectId);
        expect(meta.clientName).toBe('Nur Bukhara Solar');
    });
});

describe('resolvePartnerReportClientLabel', () => {
    it('does not return em dash when client can be resolved from project', () => {
        const extra = new Map<string, PartnerReportRowDisplayMeta>([
            ['proj-1', { projectName: 'Legal services', clientName: '', clientId: '' }],
        ]);
        expect(resolvePartnerReportClientLabel(row(), projectRows, clientNamesById, extra)).toBe('Nur Bukhara Solar');
    });
});
