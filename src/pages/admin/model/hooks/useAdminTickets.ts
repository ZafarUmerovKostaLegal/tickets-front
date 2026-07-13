import { useState, useCallback, useMemo, useEffect } from 'react';
import { getTickets, getTicket, getStatuses, getPriorities, type Ticket, type StatusItem, type PriorityItem, } from '@entities/ticket';
export function useAdminTickets() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketsError, setTicketsError] = useState<string | null>(null);
    const [ticketSearch, setTicketSearch] = useState('');
    const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
    const [ticketPriorityFilter, setTicketPriorityFilter] = useState<string>('all');
    const [includeArchivedTickets, setIncludeArchivedTickets] = useState(false);
    const [statusOptions, setStatusOptions] = useState<StatusItem[]>([]);
    const [priorityOptions, setPriorityOptions] = useState<PriorityItem[]>([]);
    const [ticketDetails, setTicketDetails] = useState<Ticket | null>(null);
    const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
    const [ticketDetailsError, setTicketDetailsError] = useState<string | null>(null);
    const loadTicketDictionaries = useCallback(async () => {
        try {
            const [statuses, priorities] = await Promise.all([
                getStatuses().catch(() => []),
                getPriorities().catch(() => []),
            ]);
            setStatusOptions(statuses);
            setPriorityOptions(priorities);
        }
        catch {
            setStatusOptions([]);
            setPriorityOptions([]);
        }
    }, []);
    useEffect(() => {
        loadTicketDictionaries();
    }, [loadTicketDictionaries]);
    const loadTickets = useCallback(async () => {
        setTicketsLoading(true);
        setTicketsError(null);
        try {
            const params: Parameters<typeof getTickets>[0] = {
                limit: 200,
                include_archived: includeArchivedTickets,
            };
            if (ticketStatusFilter !== 'all')
                params.status = ticketStatusFilter;
            if (ticketPriorityFilter !== 'all')
                params.priority = ticketPriorityFilter;
            const list = await getTickets(params);
            setTickets(list);
        }
        catch (e) {
            setTicketsError(e instanceof Error ? e.message : 'Не удалось загрузить тикеты');
            setTickets([]);
        }
        finally {
            setTicketsLoading(false);
        }
    }, [includeArchivedTickets, ticketStatusFilter, ticketPriorityFilter]);
    useEffect(() => {
        loadTickets();
    }, [loadTickets]);
    const filteredTickets = useMemo(() => {
        const q = ticketSearch.trim().toLowerCase();
        return tickets.filter((t) => {
            if (!q)
                return true;
            return (t.theme.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.category.toLowerCase().includes(q) ||
                t.priority.toLowerCase().includes(q));
        });
    }, [tickets, ticketSearch]);
    const openTicketDetails = useCallback(async (ticket: Ticket) => {
        setTicketDetails(ticket);
        setTicketDetailsLoading(true);
        setTicketDetailsError(null);
        try {
            const fresh = await getTicket(ticket.uuid);
            setTicketDetails(fresh);
        }
        catch (e) {
            setTicketDetailsError(e instanceof Error ? e.message : 'Не удалось загрузить детали тикета');
        }
        finally {
            setTicketDetailsLoading(false);
        }
    }, []);
    const closeTicketDetails = useCallback(() => setTicketDetails(null), []);
    return {
        tickets,
        ticketsLoading,
        ticketsError,
        ticketSearch,
        setTicketSearch,
        ticketStatusFilter,
        setTicketStatusFilter,
        ticketPriorityFilter,
        setTicketPriorityFilter,
        includeArchivedTickets,
        setIncludeArchivedTickets,
        statusOptions,
        priorityOptions,
        filteredTickets,
        loadTickets,
        ticketDetails,
        ticketDetailsLoading,
        ticketDetailsError,
        openTicketDetails,
        closeTicketDetails,
    };
}
