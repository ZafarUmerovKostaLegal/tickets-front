export const TICKET_STATUSES = [
    { value: 'new', label: 'Новый' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'closed', label: 'Закрыт' },
];

export const TICKET_PRIORITIES = [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий' },
];

export const SAMPLE_TICKET = {
    id: 1,
    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    theme: 'Тестовый тикет',
    description: 'Описание тестового тикета',
    category: 'IT',
    status: 'new',
    priority: 'medium',
    created_by_user_id: 1,
    creator_name: 'Иван Сотрудников',
    created_at: '2024-06-01T10:00:00.000Z',
    updated_at: '2024-06-01T10:00:00.000Z',
    attachment_path: null as string | null,
    is_archived: false,
};

export const TODO_BOARD = {
    id: 1,
    title: 'Моя доска',
    visibility: 'private',
    color: null,
    background_url: null,
    my_role: 'owner',
    board_labels: [] as unknown[],
    columns: [
        {
            id: 1,
            title: 'К выполнению',
            position: 0,
            cards: [] as unknown[],
        },
        {
            id: 2,
            title: 'В работе',
            position: 1,
            cards: [] as unknown[],
        },
    ],
};

export const TODO_BOARDS_LIST = {
    items: [{ id: 1, title: 'Моя доска', visibility: 'private', color: null, background_url: null }],
    current_board_id: 1,
    last_selected_board_id: 1,
};

export const CHAT_ROOMS = {
    items: [
        {
            id: 1,
            title: 'Общий канал',
            kind: 'channel',
            is_company_channel: true,
            unread_count: 0,
            last_message_at: '2024-06-01T10:00:00.000Z',
            last_message_preview: 'Привет!',
        },
    ],
};

export const CHAT_MESSAGES = {
    items: [
        {
            id: 101,
            room_id: 1,
            author_user_id: 2,
            message_kind: 'text',
            body: 'Тестовое входящее сообщение',
            created_at: '2024-06-01T10:00:00.000Z',
            edited_at: null,
            is_deleted: false,
            attachments: [],
            reply_to: null,
            reactions: [],
            poll: null,
        },
    ],
    has_more: false,
};

export const EXPENSE_TYPES = [
    { id: 1, name: 'Транспорт', is_active: true },
    { id: 2, name: 'Питание', is_active: true },
];

export const TT_CLIENT = {
    id: 'client-1',
    name: 'Demo Client',
    currency: 'USD',
    is_active: true,
};

export const TT_PROJECT = {
    id: 'demo-project',
    client_id: 'client-1',
    name: 'Demo Project',
    billing_type: 'Время и материалы',
    is_active: true,
    is_billable: true,
};

export const DAILY_ATTENDANCE_REPORT = {
    date: '2024-06-01',
    workday: {
        workday_start: '09:00',
        workday_end: '18:00',
        late_threshold_minutes: 15,
        daily_hours_norm: 8,
        late_border_time: '09:15',
    },
    summary: {
        total_tracked_users: 0,
        present_on_time: 0,
        late: 0,
        absent: 0,
        unmapped_events: 0,
    },
    items: [] as unknown[],
    unmapped_events: [] as unknown[],
};

export const WORKDAY_SETTINGS = {
    workday_start: '09:00',
    workday_end: '18:00',
    late_threshold_minutes: 15,
    daily_hours_norm: 8,
};
