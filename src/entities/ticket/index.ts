export type { Ticket, Comment, StatusItem, PriorityItem, TicketsParams } from './model/types';
export type { UpdateTicketData } from './api';
export { getStatuses, getPriorities, getTickets, getTicket, createTicket, updateTicket, archiveTicket, getComments, addComment, updateComment, getAttachmentUrl, } from './api';
export { listTicketsWs, listStatusesWs, listPrioritiesWs, getTicketWs, updateTicketWs, archiveTicketWs, listCommentsWs, addCommentWs, editCommentWs, deleteCommentWs, closeTicketsWs, subscribeTicketsWsPush, connectTicketsWsWhenReady, } from './ticketsWs';
