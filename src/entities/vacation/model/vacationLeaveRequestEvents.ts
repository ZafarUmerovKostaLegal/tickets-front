export const VACATION_LEAVE_REQUESTS_INVALIDATE_EVENT = 'vacation-leave-requests-invalidate';

export function invalidateVacationLeaveRequests(): void {
    window.dispatchEvent(new CustomEvent(VACATION_LEAVE_REQUESTS_INVALIDATE_EVENT));
}
