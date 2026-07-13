import { describe, expect, it } from 'vitest';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import {
    buildArchivedAuthUserIds,
    buildArchivedEmployeeNames,
    filterActiveEmployeeNames,
    isActiveReportPreviewEmployee,
} from './reportPreviewActiveEmployees';

describe('reportPreviewActiveEmployees', () => {
    const users = [
        { id: 1, display_name: 'Active User', email: 'a@x.com', is_archived: false, is_blocked: false },
        { id: 2, display_name: 'Archived User', email: 'b@x.com', is_archived: true, is_blocked: false },
    ] as TimeTrackingUserRow[];

    it('marks archived auth user ids', () => {
        expect(buildArchivedAuthUserIds(users)).toEqual(new Set([2]));
    });

    it('marks archived display names', () => {
        expect(buildArchivedEmployeeNames(users)).toEqual(new Set(['Archived User']));
    });

    it('filters active employee names', () => {
        expect(filterActiveEmployeeNames(['Active User', 'Archived User'], buildArchivedEmployeeNames(users)))
            .toEqual(['Active User']);
    });

    it('treats unknown auth user ids as active', () => {
        expect(isActiveReportPreviewEmployee(99, buildArchivedAuthUserIds(users))).toBe(true);
        expect(isActiveReportPreviewEmployee(2, buildArchivedAuthUserIds(users))).toBe(false);
    });
});
