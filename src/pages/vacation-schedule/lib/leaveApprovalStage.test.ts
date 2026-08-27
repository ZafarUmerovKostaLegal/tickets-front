import { describe, expect, it } from 'vitest';
import type { VacationLeaveRequestApi } from '@entities/vacation';
import {
    canDecideLeaveRequest,
    isDirectManagingPartnerRequest,
    leaveApprovalWaitingFor,
    leaveRequestAvailableActions,
    leaveRequestMatchesInboxFilter,
} from './leaveApprovalStage';

const PARTNER_ID = 7;
const EMPLOYEE_ID = 42;
const MANAGING_EMAIL = 'aakhmadjonov@kostalegal.com';

function makeRequest(overrides: Partial<VacationLeaveRequestApi> = {}): VacationLeaveRequestApi {
    return {
        id: 11,
        status: 'pending',
        kind_code: 1,
        kind: 'annual_vacation',
        employee_user_id: EMPLOYEE_ID,
        employee_full_name: 'Zafar Umerov',
        employee_email: 'zumerov@kostalegal.com',
        employee_position: 'Партнер',
        partner_user_id: PARTNER_ID,
        partner_full_name: 'Nail Hassanov',
        partner_email: 'nhassanov@kostalegal.com',
        date_from: '2026-06-22',
        date_to: '2026-06-24',
        days_count: 3,
        reason: null,
        decision_at: null,
        decision_reason: null,
        final_decision_at: null,
        final_decision_reason: null,
        managing_partner_full_name: 'Azizbek Akhmadjonov',
        managing_partner_email: MANAGING_EMAIL,
        pdf_url: '/api/v1/vacations/leave-requests/11/pdf',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: null,
        ...overrides,
    };
}

describe('canDecideLeaveRequest', () => {
    it('первую ступень решает только выбранный курирующий партнёр', () => {
        const req = makeRequest();

        expect(canDecideLeaveRequest(req, { userId: PARTNER_ID, userEmail: 'nhassanov@kostalegal.com' })).toBe(true);
        expect(canDecideLeaveRequest(req, { userId: 99, userEmail: MANAGING_EMAIL })).toBe(false);
    });

    it('вторую ступень пропускает, если курирующий — сам управляющий партнёр', () => {
        const req = makeRequest({
            partner_user_id: 99,
            partner_email: MANAGING_EMAIL,
            partner_full_name: 'Azizbek Akhmadjonov',
        });

        expect(isDirectManagingPartnerRequest(req)).toBe(true);
        expect(canDecideLeaveRequest(req, { userId: 99, userEmail: MANAGING_EMAIL })).toBe(true);
        expect(leaveApprovalWaitingFor(req)).toBe('Azizbek Akhmadjonov');
    });

    it('вторую ступень решает только управляющий партнёр', () => {
        const req = makeRequest({ status: 'pending_final' });

        expect(canDecideLeaveRequest(req, { userId: 99, userEmail: MANAGING_EMAIL })).toBe(true);
        expect(canDecideLeaveRequest(req, { userId: PARTNER_ID, userEmail: 'nhassanov@kostalegal.com' })).toBe(false);
    });

    it('по завершённым заявкам решать нечего', () => {
        for (const status of ['approved', 'declined', 'cancelled'] as const) {
            const req = makeRequest({ status });
            expect(canDecideLeaveRequest(req, { userId: PARTNER_ID, userEmail: MANAGING_EMAIL })).toBe(false);
        }
    });
});

describe('leaveApprovalWaitingFor', () => {
    it('показывает текущего согласующего на каждой ступени', () => {
        expect(leaveApprovalWaitingFor(makeRequest())).toBe('Nail Hassanov');
        expect(leaveApprovalWaitingFor(makeRequest({ status: 'pending_final' }))).toBe('Azizbek Akhmadjonov');
        expect(leaveApprovalWaitingFor(makeRequest({ status: 'approved' }))).toBeNull();
    });
});

describe('leaveRequestMatchesInboxFilter', () => {
    it('на вкладке «На согласовании» без чипа показывает только ожидающие решения', () => {
        expect(leaveRequestMatchesInboxFilter(makeRequest(), 'any', 'to_decide')).toBe(true);
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'pending_final' }), 'any', 'to_decide')).toBe(true);
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'approved' }), 'any', 'to_decide')).toBe(false);
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'declined' }), 'any', 'to_decide')).toBe(false);
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'cancelled' }), 'any', 'to_decide')).toBe(false);
    });

    it('выбранный чип оставляет только этот статус', () => {
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'declined' }), 'declined', 'to_decide')).toBe(true);
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'approved' }), 'declined', 'to_decide')).toBe(false);
    });

    it('в «Мои» и «Все» без чипа показывает все статусы', () => {
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'approved' }), 'any', 'mine')).toBe(true);
        expect(leaveRequestMatchesInboxFilter(makeRequest({ status: 'cancelled' }), 'any', 'all')).toBe(true);
    });
});

describe('leaveRequestAvailableActions', () => {
    const author = { userId: EMPLOYEE_ID, userEmail: 'zumerov@kostalegal.com', isAuthor: true, canActAsDecider: false };
    const partner = { userId: PARTNER_ID, userEmail: 'nhassanov@kostalegal.com', isAuthor: false, canActAsDecider: true };

    it('автору даёт отозвать заявку на согласовании и удалить после отказа', () => {
        expect(leaveRequestAvailableActions(makeRequest(), author)).toMatchObject({
            canWithdraw: true,
            canCancelApproved: false,
            canDelete: false,
            canDecide: false,
        });
        expect(leaveRequestAvailableActions(makeRequest({ status: 'declined' }), author)).toMatchObject({
            canWithdraw: false,
            canDelete: true,
        });
        expect(leaveRequestAvailableActions(makeRequest({ status: 'approved' }), author)).toMatchObject({
            canCancelApproved: true,
            canDelete: false,
        });
    });

    it('партнёру даёт удалить любую заявку', () => {
        const asPartner = { ...partner, isPartner: true };
        expect(leaveRequestAvailableActions(makeRequest(), asPartner).canDelete).toBe(true);
        expect(leaveRequestAvailableActions(makeRequest({ status: 'approved' }), asPartner).canDelete).toBe(true);
        expect(leaveRequestAvailableActions(makeRequest({ status: 'pending_final' }), asPartner).canDelete).toBe(true);
    });

    it('согласующему даёт утвердить или отклонить на своей ступени', () => {
        expect(leaveRequestAvailableActions(makeRequest(), partner).canDecide).toBe(true);
        expect(leaveRequestAvailableActions(makeRequest({ status: 'pending_final' }), partner).canDecide).toBe(false);
    });
});
