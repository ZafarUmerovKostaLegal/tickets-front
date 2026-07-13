export type MockUser = {
    id: number;
    email: string;
    display_name: string;
    picture: string | null;
    role: string;
    position: string | null;
    is_blocked: boolean;
    is_archived: boolean;
    time_tracking_role: 'user' | 'manager' | null;
    weekly_capacity_hours: number | null;
    created_at: string;
    updated_at: string | null;
    desktop_background: string | null;
    permissions?: Record<string, unknown>;
};

const BASE_TS = '2024-01-01T00:00:00.000Z';

function makeUser(partial: Partial<MockUser> & Pick<MockUser, 'id' | 'role'>): MockUser {
    return {
        email: `user${partial.id}@kostalegal.com`,
        display_name: `User ${partial.id}`,
        picture: null,
        position: null,
        is_blocked: false,
        is_archived: false,
        time_tracking_role: null,
        weekly_capacity_hours: 40,
        created_at: BASE_TS,
        updated_at: BASE_TS,
        desktop_background: null,
        ...partial,
    };
}

export const USERS = {
    employee: makeUser({
        id: 1,
        role: 'Сотрудник',
        display_name: 'Иван Сотрудников',
        email: 'employee@kostalegal.com',
        time_tracking_role: 'user',
    }),
    manager: makeUser({
        id: 2,
        role: 'Юрист',
        display_name: 'Мария Менеджер',
        email: 'manager@kostalegal.com',
        time_tracking_role: 'manager',
        permissions: { time_tracking_can_view_reports: true },
    }),
    admin: makeUser({
        id: 3,
        role: 'Администратор',
        display_name: 'Админ Системный',
        email: 'admin@kostalegal.com',
        time_tracking_role: 'manager',
        permissions: {
            time_tracking_can_view_reports: true,
            time_tracking_can_manage_org_users: true,
            can_view_user_directory: true,
            vacation_can_manage_schedule: true,
            attendance_can_manage_hikvision_mappings: true,
        },
    }),
    partner: makeUser({
        id: 4,
        role: 'Партнёр',
        display_name: 'Пётр Партнёров',
        email: 'partner@kostalegal.com',
        position: 'Партнёр',
        time_tracking_role: 'manager',
        permissions: { time_tracking_can_view_reports: true },
    }),
    blocked: makeUser({
        id: 5,
        role: 'Сотрудник',
        display_name: 'Заблокированный',
        email: 'blocked@kostalegal.com',
        is_blocked: true,
    }),
    archived: makeUser({
        id: 6,
        role: 'Сотрудник',
        display_name: 'Архивный',
        email: 'archived@kostalegal.com',
        is_archived: true,
    }),
    noTimeTracking: makeUser({
        id: 7,
        role: 'Юрист',
        display_name: 'Без учёта времени',
        email: 'no-tt@kostalegal.com',
        time_tracking_role: null,
    }),
} as const;

export type UserPersona = keyof typeof USERS;
