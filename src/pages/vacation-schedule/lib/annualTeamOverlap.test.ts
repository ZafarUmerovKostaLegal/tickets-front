import { describe, expect, it } from 'vitest';
import type { TimeTrackingTeamRow } from '@entities/time-tracking';
import type { VacationAbsenceDayApi, VacationLeaveRequestApi, VacationScheduleEmployeeApi } from '@entities/vacation';
import { summarizeAnnualTeamOverlap } from './annualTeamOverlap';

const ME = 10;
const TEAMMATE = 20;

function team(overrides: Partial<TimeTrackingTeamRow> = {}): TimeTrackingTeamRow {
    return {
        id: 'lit',
        name: 'Litigation',
        partner_auth_user_id: 1,
        member_auth_user_ids: [ME, TEAMMATE],
        is_archived: false,
        ...overrides,
    };
}

function employee(overrides: Partial<VacationScheduleEmployeeApi> = {}): VacationScheduleEmployeeApi {
    return {
        id: 5,
        year: 2026,
        excel_row_no: null,
        full_name: 'Анна Иванова',
        planned_period_note: null,
        auth_user_id: TEAMMATE,
        email: null,
        ...overrides,
    };
}

function day(overrides: Partial<VacationAbsenceDayApi> = {}): VacationAbsenceDayApi {
    return {
        employee_id: 5,
        full_name: 'Анна Иванова',
        absence_on: '2026-09-11',
        kind_code: 1,
        kind: 'annual_vacation',
        ...overrides,
    };
}

function request(overrides: Partial<VacationLeaveRequestApi> = {}): VacationLeaveRequestApi {
    return {
        id: 1,
        status: 'pending',
        kind_code: 1,
        kind: 'annual_vacation',
        employee_user_id: TEAMMATE,
        employee_full_name: 'Анна Иванова',
        employee_email: 'anna@example.com',
        employee_position: null,
        partner_user_id: 1,
        partner_full_name: 'Партнёр',
        partner_email: 'p@example.com',
        date_from: '2026-09-11',
        date_to: '2026-09-15',
        days_count: 5,
        reason: null,
        decision_at: null,
        decision_reason: null,
        final_decision_at: null,
        final_decision_reason: null,
        managing_partner_full_name: null,
        managing_partner_email: null,
        pdf_url: '',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: null,
        ...overrides,
    };
}

function summarize(overrides: Partial<Parameters<typeof summarizeAnnualTeamOverlap>[0]> = {}) {
    return summarizeAnnualTeamOverlap({
        userId: ME,
        dateFrom: '2026-09-12',
        dateTo: '2026-09-14',
        teams: [team()],
        employees: [employee()],
        absenceDays: [],
        leaveRequests: [],
        ...overrides,
    });
}

describe('summarizeAnnualTeamOverlap', () => {
    it('warns when a teammate already has annual days on the chosen dates', () => {
        const text = summarize({
            absenceDays: [day(), day({ absence_on: '2026-09-12' }), day({ absence_on: '2026-09-13' })],
        });
        expect(text).toBe(
            'В команде «Litigation» на эти даты уже забронирован отпуск: Анна Иванова (11.09 — 13.09.2026).',
        );
    });

    it('ignores other absence kinds and people outside the team', () => {
        expect(summarize({
            absenceDays: [
                day({ kind: 'sick_leave', kind_code: 2 }),
                day({ employee_id: 9, full_name: 'Чужой' }),
            ],
            employees: [employee(), employee({ id: 9, auth_user_id: 99, full_name: 'Чужой' })],
        })).toBeNull();
    });

    it('ignores the applicant and archived teams', () => {
        expect(summarize({
            absenceDays: [day({ employee_id: 8 })],
            employees: [employee({ id: 8, auth_user_id: ME, full_name: 'Я' })],
        })).toBeNull();
        expect(summarize({
            teams: [team({ is_archived: true })],
            leaveRequests: [request()],
        })).toBeNull();
    });

    it('counts pending and approved annual requests, not declined ones', () => {
        expect(summarize({ leaveRequests: [request()] })).toContain('Анна Иванова (11.09 — 15.09.2026)');
        expect(summarize({ leaveRequests: [request({ status: 'declined' })] })).toBeNull();
        expect(summarize({ leaveRequests: [request({ status: 'cancelled' })] })).toBeNull();
        expect(summarize({
            leaveRequests: [request({ date_from: '2026-10-01', date_to: '2026-10-05' })],
        })).toBeNull();
    });

    it('merges a request and calendar days of the same person into one span', () => {
        const text = summarize({
            absenceDays: [day({ absence_on: '2026-09-16' })],
            leaveRequests: [request()],
        });
        expect(text).toContain('Анна Иванова (11.09 — 16.09.2026)');
        expect(text?.match(/Анна Иванова/g)).toHaveLength(1);
    });
});
