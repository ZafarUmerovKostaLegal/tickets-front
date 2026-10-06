import { describe, expect, it } from 'vitest';
import { normalizeTimeManagerClientProjectRow } from './projects';

describe('normalizeTimeManagerClientProjectRow', () => {
  it('maps progressBudgetAmount alias onto progress_budget_amount', () => {
    const row = normalizeTimeManagerClientProjectRow({
      id: 'p1',
      client_id: 'c1',
      name: 'Demo',
      code: null,
      start_date: null,
      end_date: null,
      notes: null,
      report_visibility: 'managers_only',
      project_type: 'time_and_materials',
      billable_rate_type: 'person_billable_rate',
      budget_type: 'money',
      budget_amount: null,
      progressBudgetAmount: '15000',
      budget_hours: null,
      budget_resets_every_month: false,
      budget_includes_expenses: false,
      send_budget_alerts: false,
      budget_alert_threshold_percent: null,
      fixed_fee_amount: null,
      usage_count: 0,
      deletable: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: null,
    });
    expect(row).not.toBeNull();
    expect(row!.progress_budget_amount).toBe('15000');
    expect(row!.progressBudgetAmount).toBe('15000');
  });

  it('keeps snake_case progress_budget_amount when both are present', () => {
    const row = normalizeTimeManagerClientProjectRow({
      id: 'p2',
      clientId: 'c2',
      name: 'Demo 2',
      report_visibility: 'managers_only',
      project_type: 'time_and_materials',
      billable_rate_type: null,
      budget_type: 'money',
      budget_amount: null,
      progress_budget_amount: '9000',
      progressBudgetAmount: '15000',
      budget_hours: null,
      budget_resets_every_month: false,
      budget_includes_expenses: false,
      send_budget_alerts: false,
      budget_alert_threshold_percent: null,
      fixed_fee_amount: null,
      usage_count: 0,
      deletable: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: null,
    });
    expect(row).not.toBeNull();
    expect(row!.client_id).toBe('c2');
    expect(row!.progress_budget_amount).toBe('9000');
  });
});
