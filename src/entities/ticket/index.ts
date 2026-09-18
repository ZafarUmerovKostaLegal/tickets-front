export type { Ticket, Comment, StatusItem, PriorityItem, TicketsParams } from './model/types';
export type { UpdateTicketData } from './api';
export {
    getStatuses,
    getPriorities,
    getTickets,
    getTicket,
    createTicket,
    updateTicket,
    archiveTicket,
    submitTicketForApproval,
    approveTicket,
    rejectTicket,
    getComments,
    addComment,
    updateComment,
    getAttachmentUrl,
    invalidateTicketStaticCache,
} from './api';
export { isTicketOnApprovalStatus, TICKET_STATUS_ON_APPROVAL } from './lib/ticketApproval';
export { listTicketsWs, listStatusesWs, listPrioritiesWs, getTicketWs, updateTicketWs, archiveTicketWs, listCommentsWs, addCommentWs, editCommentWs, deleteCommentWs, closeTicketsWs, subscribeTicketsWsPush, connectTicketsWsWhenReady, } from './ticketsWs';
