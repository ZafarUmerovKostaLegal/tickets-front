import { isVacationManagingPartner, VACATION_MANAGING_PARTNER_NAME, } from '@entities/vacation';
const AWAITING_DECISION = new Set(['pending', 'pending_final']);
/** Вкладка «На согласовании» без выбранного чипа — только заявки, которые ещё ждут решения. */
export function leaveRequestMatchesInboxFilter(req, filter, mode) {
    if (filter !== 'any')
        return req.status === filter;
    if (mode === 'to_decide')
        return AWAITING_DECISION.has(req.status);
    return true;
}
/**
 * Заявка проходит две ступени: сначала выбранный курирующий партнёр, затем
 * обязательное финальное подтверждение управляющего партнёра. Его адрес и ФИО
 * приходят с бэкенда вместе с заявкой, поэтому сверяемся именно с ними.
 */
export function isManagingPartnerEmail(userEmail, req) {
    return isVacationManagingPartner(userEmail, req.managing_partner_email);
}
/** Сотрудник выбрал управляющего партнёра курирующим — второй ступени нет. */
export function isDirectManagingPartnerRequest(req) {
    return isVacationManagingPartner(req.partner_email, req.managing_partner_email);
}
/** Кто и на какой ступени вправе решить: статус заявки однозначно задаёт ступень. */
export function canDecideLeaveRequest(req, actor) {
    if (req.status === 'pending')
        return actor.userId != null && req.partner_user_id === actor.userId;
    if (req.status === 'pending_final')
        return isManagingPartnerEmail(actor.userEmail, req);
    return false;
}
/** Кто ждёт решения по заявке: подпись для карточки. */
export function leaveApprovalWaitingFor(req) {
    if (req.status === 'pending') {
        if (isDirectManagingPartnerRequest(req))
            return req.managing_partner_full_name || req.partner_full_name || VACATION_MANAGING_PARTNER_NAME;
        return req.partner_full_name || req.partner_email || 'курирующий партнёр';
    }
    if (req.status === 'pending_final')
        return req.managing_partner_full_name || VACATION_MANAGING_PARTNER_NAME;
    return null;
}
/** Какие кнопки показывать автору и согласующему на текущей ступени. */
export function leaveRequestAvailableActions(req, viewer) {
    const authorFinal = req.status === 'cancelled' || req.status === 'declined';
    return {
        canDecide: viewer.canActAsDecider && canDecideLeaveRequest(req, viewer),
        canWithdraw: viewer.isAuthor && (req.status === 'pending' || req.status === 'pending_final'),
        canCancelApproved: viewer.isAuthor && req.status === 'approved',
        canDelete: Boolean(viewer.isPartner) || (viewer.isAuthor && authorFinal),
    };
}
