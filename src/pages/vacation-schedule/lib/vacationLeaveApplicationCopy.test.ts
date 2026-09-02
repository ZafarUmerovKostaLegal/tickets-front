import { describe, expect, it } from 'vitest';
import type { VacationLeaveRequestApi } from '@entities/vacation';
import { buildVacationLeaveApplicationCopy, LEAVE_APPLICATION_ADDRESSEE } from './vacationLeaveApplicationCopy';

function req(overrides: Partial<VacationLeaveRequestApi> = {}): VacationLeaveRequestApi {
    return {
        id: 11,
        status: 'pending',
        kind_code: 1,
        kind: 'annual_vacation',
        employee_user_id: 42,
        employee_full_name: 'Zafar Umerov',
        employee_email: 'zumerov@kostalegal.com',
        employee_position: 'Юрист',
        partner_user_id: 7,
        partner_full_name: 'Nail Hassanov',
        partner_email: 'nhassanov@kostalegal.com',
        date_from: '2026-06-22',
        date_to: '2026-07-05',
        days_count: 14,
        reason: null,
        decision_at: null,
        decision_reason: null,
        final_decision_at: null,
        final_decision_reason: null,
        managing_partner_full_name: 'Azizbek Akhmadjonov',
        managing_partner_email: 'aakhmadjonov@kostalegal.com',
        pdf_url: '/api/v1/vacations/leave-requests/11/pdf',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: null,
        ...overrides,
    };
}

describe('buildVacationLeaveApplicationCopy', () => {
    it('matches the official annual leave wording', () => {
        const copy = buildVacationLeaveApplicationCopy(req());
        expect(copy.addressee).toBe(LEAVE_APPLICATION_ADDRESSEE);
        expect(copy.title).toBe('Заявление');
        expect(copy.subtitle).toBe('о предоставлении ежегодного оплачиваемого отпуска');
        expect(copy.bodyBeforeDays).toContain('очередной ежегодный оплачиваемый отпуск');
        expect(copy.daysCount).toBe('14');
        expect(copy.fromLine).toBe('Zafar Umerov, Юрист');
        expect(copy.signerLine).toBe('Zafar Umerov, Юрист');
        expect(copy.bodyAfterTo).toBe('включительно.');
    });

    it('uses unpaid-leave wording for day_off', () => {
        const copy = buildVacationLeaveApplicationCopy(req({ kind: 'day_off', kind_code: 3 }));
        expect(copy.subtitle).toBe('о предоставлении отпуска без сохранения заработной платы');
        expect(copy.bodyBeforeDays).toContain('без сохранения заработной платы');
    });
});
