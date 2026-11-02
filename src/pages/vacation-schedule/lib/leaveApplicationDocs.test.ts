import { describe, expect, it } from 'vitest';
import { leaveDocsCoveringDate, matchApprovedLeaveApplications } from './leaveApplicationDocs';

const kamila = {
    id: 18,
    status: 'approved' as const,
    kind: 'annual_vacation',
    employee_user_id: 4,
    employee_full_name: 'Kamila Djabbarova',
    date_from: '2026-07-20',
    date_to: '2026-07-24',
};

describe('matchApprovedLeaveApplications', () => {
    it('keeps an approved application that covers a schedule day of the same person', () => {
        const docs = matchApprovedLeaveApplications({
            requests: [
                kamila,
                { ...kamila, id: 19, employee_full_name: 'Sayora Rasulova', date_from: '2026-10-05', date_to: '2026-10-06' },
                { ...kamila, id: 20, status: 'pending', date_from: '2026-10-21', date_to: '2026-10-21' },
            ],
            employeeName: '  kamila   djabbarova ',
            authUserId: null,
            days: [{ absence_on: '2026-07-22' }, { absence_on: '2026-10-21' }],
        });
        expect(docs.map((doc) => doc.leaveRequestId)).toEqual([18]);
    });

    it('matches a linked system user even when the schedule name differs', () => {
        const docs = matchApprovedLeaveApplications({
            requests: [kamila],
            employeeName: 'Другое имя',
            authUserId: 4,
            days: [{ absence_on: '2026-07-20' }],
        });
        expect(docs).toHaveLength(1);
        expect(leaveDocsCoveringDate(docs, '2026-07-23')).toHaveLength(1);
        expect(leaveDocsCoveringDate(docs, '2026-07-25')).toHaveLength(0);
    });
});
