import {
    isVacationManagingPartner,
    VACATION_MANAGING_PARTNER_NAME,
    type VacationLeaveRequestApi,
    type VacationLeaveRequestStatus,
} from '@entities/vacation';

export type LeaveInboxFilter = VacationLeaveRequestStatus | 'any';

const AWAITING_DECISION: ReadonlySet<VacationLeaveRequestStatus> = new Set(['pending', 'pending_final']);

export function leaveRequestMatchesInboxFilter(
    req: VacationLeaveRequestApi,
    filter: LeaveInboxFilter,
    mode: 'mine' | 'to_decide' | 'all',
): boolean {
    if (filter !== 'any')
        return req.status === filter;
    if (mode === 'to_decide')
        return AWAITING_DECISION.has(req.status);
    return true;
}

export function isManagingPartnerEmail(
    userEmail: string | null | undefined,
    req: VacationLeaveRequestApi,
): boolean {
    return isVacationManagingPartner(userEmail, req.managing_partner_email);
}

export function isDirectManagingPartnerRequest(req: VacationLeaveRequestApi): boolean {
    return isVacationManagingPartner(req.partner_email, req.managing_partner_email);
}

export type LeaveDecisionActor = {
    userId: number | null | undefined;
    userEmail: string | null | undefined;
};

export function canDecideLeaveRequest(req: VacationLeaveRequestApi, actor: LeaveDecisionActor): boolean {
    if (req.status === 'pending')
        return actor.userId != null && req.partner_user_id === actor.userId;
    if (req.status === 'pending_final')
        return isManagingPartnerEmail(actor.userEmail, req);
    return false;
}

export function leaveApprovalWaitingFor(req: VacationLeaveRequestApi): string | null {
    if (req.status === 'pending') {
        if (isDirectManagingPartnerRequest(req))
            return req.managing_partner_full_name || req.partner_full_name || VACATION_MANAGING_PARTNER_NAME;
        return req.partner_full_name || req.partner_email || 'курирующий партнёр';
    }
    if (req.status === 'pending_final')
        return req.managing_partner_full_name || VACATION_MANAGING_PARTNER_NAME;
    return null;
}

export type LeaveRequestViewer = LeaveDecisionActor & {
    isAuthor: boolean;
    canActAsDecider: boolean;
    isPartner?: boolean;
};

export type LeaveRequestAvailableActions = {
    canDecide: boolean;
    canWithdraw: boolean;
    canCancelApproved: boolean;
    canDelete: boolean;
};

export function leaveRequestAvailableActions(
    req: VacationLeaveRequestApi,
    viewer: LeaveRequestViewer,
): LeaveRequestAvailableActions {
    const authorFinal = req.status === 'cancelled' || req.status === 'declined';
    return {
        canDecide: viewer.canActAsDecider && canDecideLeaveRequest(req, viewer),
        canWithdraw: viewer.isAuthor && (req.status === 'pending' || req.status === 'pending_final'),
        canCancelApproved: viewer.isAuthor && req.status === 'approved',
        canDelete: Boolean(viewer.isPartner) || (viewer.isAuthor && authorFinal),
    };
}
