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
        expect(copy.bodyParts.some((p) => p.type === 'text' && p.text.includes('очередной ежегодный оплачиваемый отпуск'))).toBe(true);
        expect(copy.bodyParts.some((p) => p.type === 'field' && p.text === '14')).toBe(true);
        expect(copy.fromLine).toBe('Zafar Umerov, Юрист');
        expect(copy.signerLine).toBe('Zafar Umerov, Юрист');
        expect(copy.bodyParts.at(-1)?.text).toBe(' включительно.');
    });

    it('uses unpaid-leave wording for day_off', () => {
        const copy = buildVacationLeaveApplicationCopy(req({ kind: 'day_off', kind_code: 3 }));
        expect(copy.title).toBe('Заявление о предоставлении отпуска без сохранения заработной платы');
        expect(copy.subtitle).toBe('');
        expect(copy.bodyParts.some((p) => p.type === 'text' && p.text.includes('без сохранения заработной платы'))).toBe(true);
    });

    it('uses remote-work wording with a date range', () => {
        const copy = buildVacationLeaveApplicationCopy(req({ kind: 'remote_work', kind_code: 5 }));
        expect(copy.title).toBe('Заявление');
        expect(copy.subtitle).toBe('о выходе на удаленный режим работы');
        expect(copy.bodyParts[0]?.type).toBe('text');
        expect(copy.bodyParts[0]?.text).toContain('осуществлять трудовую деятельность в удалённом режиме');
        expect(copy.bodyParts.some((p) => p.type === 'text' && p.text.includes('включительно'))).toBe(true);
    });

    it('uses a single date for one-day remote work', () => {
        const copy = buildVacationLeaveApplicationCopy(req({
            kind: 'remote_work',
            kind_code: 5,
            date_from: '2026-06-22',
            date_to: '2026-06-22',
            days_count: 1,
        }));
        const fields = copy.bodyParts.filter((p) => p.type === 'field').map((p) => p.text);
        expect(fields).toHaveLength(1);
        expect(copy.bodyParts.at(-1)?.text).toBe('.');
    });
});
