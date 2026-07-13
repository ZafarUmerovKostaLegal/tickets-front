
export type UserUiPermissions = {
    v: number;

    time_tracking_can_view_reports?: boolean;

    time_tracking_can_manage_org_users?: boolean;

    time_tracking_can_view_time_entries_scope?: boolean;

    time_tracking_can_manage_time_entries_scope?: boolean;

    hourly_rates_can_manage?: boolean;

    hourly_rates_admin_only_operations?: boolean;

    vacation_can_manage_schedule?: boolean;

    can_view_user_directory?: boolean;

    attendance_can_manage_hikvision_mappings?: boolean;
    [key: string]: unknown;
};
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

    initials?: string | null;
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
