export type UserUiPermissions = {
    v: number;
} & Record<string, unknown>;
export type User = {
    id: number;
    azure_oid?: string;
    email: string;
    display_name: string | null;
    picture: string | null;
    role: string;
    position: string | null;
    is_blocked: boolean;
    is_archived: boolean;
    weekly_capacity_hours?: number | null;
    time_tracking_role: 'user' | 'manager' | null;
    created_at: string;
    updated_at: string | null;
    desktop_background: string | null;
    permissions?: UserUiPermissions;
};
export type MicrosoftUser = {
    id: string;
    displayName: string | null;
    mail: string | null;
    userPrincipalName: string | null;
    givenName: string | null;
    surname: string | null;
    jobTitle: string | null;
};
