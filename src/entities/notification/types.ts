export type NotificationItem = {
    id: number;
    uuid: string;
    title: string;
    description: string;
    photo_path?: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
    notification_type?: string;
    recipient_user_id?: number | null;
};
