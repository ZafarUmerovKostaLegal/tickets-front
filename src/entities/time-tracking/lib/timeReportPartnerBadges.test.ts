import { describe, expect, it } from 'vitest';
import {
    badgeForProjectInReportWindow,
    buildClientPartnerBadgeMap,
    maxPartnerBadge,
    reportDateRangesOverlap,
    type TimeReportPartnerConfSlice,
} from './timeReportPartnerBadges';

const conf: TimeReportPartnerConfSlice = { projectId: 'p1', dateFrom: '2026-10-01', dateTo: '2026-10-31', snapshotId: 's1' };
const window = { windowFrom: '2026-10-15', windowTo: '2026-11-15' };

describe('reportDateRangesOverlap', () => {
    it('detects overlapping and touching ranges and ignores empty ones', () => {
        expect(reportDateRangesOverlap('2026-10-01', '2026-10-31', '2026-10-31T10:00', '2026-11-05')).toBe(true);
        expect(reportDateRangesOverlap('2026-10-01', '2026-10-31', '2026-11-01', '2026-11-05')).toBe(false);
        expect(reportDateRangesOverlap('', '2026-10-31', '2026-10-01', '2026-10-05')).toBe(false);
    });
});

describe('badgeForProjectInReportWindow', () => {
    it('is "none" without an overlapping confirmation', () => {
        expect(badgeForProjectInReportWindow({ projectId: 'p1', ...window, confirmations: [], invoices: [] })).toBe('none');
        expect(badgeForProjectInReportWindow({ projectId: '', ...window, confirmations: [conf], invoices: [] })).toBe('none');
        expect(badgeForProjectInReportWindow({
            projectId: 'p1', windowFrom: '2026-12-01', windowTo: '2026-12-31', confirmations: [conf], invoices: [],
        })).toBe('none');
    });

    it('is "confirmed" when no live invoice matches', () => {
        expect(badgeForProjectInReportWindow({
            projectId: 'p1',
            ...window,
            confirmations: [conf],
            invoices: [
                { id: 'i1', projectId: 'p1', status: 'draft', partnerConfirmationSnapshotId: 's1' },
                { id: 'i2', projectId: 'p1', status: 'Cancelled', partnerConfirmationSnapshotId: 's1' },
                { id: 'i3', projectId: 'p2', status: 'sent', partnerConfirmationSnapshotId: 's1' },
            ],
        })).toBe('confirmed');
    });

    it('is "invoiced" when an invoice matches by snapshot, link or billing period', () => {
        const base = { projectId: 'p1', ...window, confirmations: [conf] };
        expect(badgeForProjectInReportWindow({ ...base, invoices: [{ id: 'i', projectId: 'p1', status: 'sent', partnerConfirmationSnapshotId: 's1' }] })).toBe('invoiced');
        expect(badgeForProjectInReportWindow({
            ...base,
            confirmations: [{ ...conf, invoiceId: 'linked' }],
            invoices: [{ id: 'linked', projectId: 'p1', status: 'paid' }],
        })).toBe('invoiced');
        expect(badgeForProjectInReportWindow({
            ...base,
            invoices: [{ id: 'i', projectId: 'p1', status: 'sent', partnerBillingPeriodFrom: '2026-10-10', partnerBillingPeriodTo: '2026-10-20' }],
        })).toBe('invoiced');
    });
});

describe('client badges', () => {
    it('keeps the strongest badge', () => {
        expect(maxPartnerBadge('none', 'confirmed')).toBe('confirmed');
        expect(maxPartnerBadge('invoiced', 'confirmed')).toBe('invoiced');
        expect(maxPartnerBadge('confirmed', 'none')).toBe('confirmed');
    });

    it('aggregates per client', () => {
        const map = buildClientPartnerBadgeMap({
            projectRows: [
                { client_id: 'c1', project_id: 'p1' },
                { client_id: 'c1', project_id: 'p2' },
                { client_id: '', project_id: 'p3' },
            ],
            ...window,
            confirmations: [conf],
            invoices: [],
        });
        expect(map.get('c1')).toBe('confirmed');
        expect(map.has('')).toBe(false);
    });
});
