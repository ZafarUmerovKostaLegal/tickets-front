import { describe, expect, it } from 'vitest';
import {
    getExpensesOpenUrl,
    getInvoiceCreateUrl,
    getInvoiceDetailUrl,
    getInvoicesListUrl,
    getProjectDetailUrl,
    getTicketDetailUrl,
    getTimeTrackingNewProjectUrl,
    getUserEditUrl,
    routes,
} from './routes';

describe('routes helpers', () => {
    it('getTicketDetailUrl кодирует uuid', () => {
        expect(getTicketDetailUrl('abc-123')).toBe('/ticket/abc-123');
    });

    it('getUserEditUrl', () => {
        expect(getUserEditUrl(42)).toBe('/admin/user/42');
    });

    it('getProjectDetailUrl с client query', () => {
        expect(getProjectDetailUrl('proj/1', 'client x')).toBe('/time-tracking/project/proj%2F1?client=client%20x');
        expect(getProjectDetailUrl('p1')).toBe('/time-tracking/project/p1');
    });

    it('getTimeTrackingNewProjectUrl с client', () => {
        expect(getTimeTrackingNewProjectUrl('c1')).toBe(`${routes.timeTrackingNewProject}?client=c1`);
        expect(getTimeTrackingNewProjectUrl('  ')).toBe(routes.timeTrackingNewProject);
    });

    it('getExpensesOpenUrl кодирует id', () => {
        expect(getExpensesOpenUrl('exp/1')).toBe('/expenses/exp%2F1');
    });

    it('getInvoiceCreateUrl и getInvoiceDetailUrl', () => {
        expect(getInvoiceCreateUrl()).toBe(routes.timeTrackingInvoiceCreate);
        expect(getInvoiceCreateUrl({ resume: true })).toBe(`${routes.timeTrackingInvoiceCreate}?resume=1`);
        expect(getInvoiceDetailUrl('abc/1')).toBe('/time-tracking/invoices/abc%2F1');
        expect(getInvoiceDetailUrl('id1', { variant: 'accounting' })).toBe('/time-tracking/invoices/id1?variant=accounting');
        expect(getInvoicesListUrl()).toBe(`${routes.timeTracking}?tab=invoices`);
        expect(getInvoicesListUrl({ variant: 'accounting' })).toBe(routes.accounting);
    });
});

describe('routes constants', () => {
    it('содержит все основные маршруты приложения', () => {
        const expected = [
            'login', 'home', 'tickets', 'authCallback', 'ticketDetail',
            'attendance', 'vacationSchedule', 'inventory', 'timeTracking',
            'todo', 'admin', 'expenses', 'rules', 'help', 'kostaDaily',
            'correspondence', 'accounting', 'contacts', 'callSchedule',
        ];
        for (const key of expected)
            expect(routes).toHaveProperty(key);
    });
});
