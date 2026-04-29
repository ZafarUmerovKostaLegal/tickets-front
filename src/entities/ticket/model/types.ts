export type Ticket = {
    id: number;
    uuid: string;
    theme: string;
    description: string;
    attachment_path: string | null;
    status: string;
    created_by_user_id: number;
    created_at: string;
    category: string;
    priority: string;
    is_archived: boolean;
};
export type Comment = {
    id: number;
    ticket_id: number;
    user_id: number;
    content: string;
    created_at: string;
    updated_at: string;
};
export type StatusItem = {
    value: string;
    label: string;
};
export type PriorityItem = {
    value: string;
    label: string;
};
export type TicketsParams = {
    skip?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    created_by_user_id?: number;
    include_archived?: boolean;
};
