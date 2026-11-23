export type ExtUser = {
    id: number;
    email: string;
    display_name: string;
    role: string;
    time_tracking_role?: 'user' | 'manager' | null;
};

export type TimerSnapshot = {
    id?: string;
    date?: string;
    project?: string;
    client?: string;
    projectId?: string;
    taskId?: string;
    task?: string;
    notes?: string;
    hours?: number;
    durationSeconds?: number;
    billable?: boolean;
};

export type TimerPayload = {
    v: 1;
    authUserId: number;
    entryId: string;
    startedAt: number;
    snapshot: TimerSnapshot;
    paused?: boolean;
};

export type AuthState = {
    token: string;
    apiBase: string;
    user: ExtUser;
};

export type ExtensionState = {
    auth: AuthState | null;
    timer: TimerPayload | null;
    todayHours: number | null;
    error: string | null;
    busy: boolean;
};
