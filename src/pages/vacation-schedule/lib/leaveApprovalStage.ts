import { isVacationManagingPartner, VACATION_MANAGING_PARTNER_NAME, type VacationLeaveRequestApi } from '@entities/vacation';

/**
 * Заявка проходит две ступени: сначала выбранный курирующий партнёр, затем
 * обязательное финальное подтверждение управляющего партнёра. Его адрес и ФИО
 * приходят с бэкенда вместе с заявкой, поэтому сверяемся именно с ними.
 */
export function isManagingPartnerEmail(
    userEmail: string | null | undefined,
    req: VacationLeaveRequestApi,
): boolean {
    return isVacationManagingPartner(userEmail, req.managing_partner_email);
}

/** Сотрудник выбрал управляющего партнёра курирующим — второй ступени нет. */
export function isDirectManagingPartnerRequest(req: VacationLeaveRequestApi): boolean {
    return isVacationManagingPartner(req.partner_email, req.managing_partner_email);
}

export type LeaveDecisionActor = {
    userId: number | null | undefined;
    userEmail: string | null | undefined;
};

/** Кто и на какой ступени вправе решить: статус заявки однозначно задаёт ступень. */
export function canDecideLeaveRequest(req: VacationLeaveRequestApi, actor: LeaveDecisionActor): boolean {
    if (req.status === 'pending')
        return actor.userId != null && req.partner_user_id === actor.userId;
    if (req.status === 'pending_final')
        return isManagingPartnerEmail(actor.userEmail, req);
    return false;
}

/** Кто ждёт решения по заявке: подпись для карточки. */
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
    /** Партнёр может удалить любую заявку, не только свою отозванную. */
    isPartner?: boolean;
};

export type LeaveRequestAvailableActions = {
    canDecide: boolean;
    canWithdraw: boolean;
    canCancelApproved: boolean;
    canDelete: boolean;
};

/** Какие кнопки показывать автору и согласующему на текущей ступени. */
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
