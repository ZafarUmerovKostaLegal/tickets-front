export type AttendanceStatus = 'present_on_time' | 'late' | 'absent';
export type DailyAttendanceItem = {
    app_user_id: number | null;
    display_name: string;
    email: string | null;
    role: string | null;
    position?: string | null;
    is_mapped?: boolean;
    camera_employee_no: string;
    camera_name: string | null;
    camera_ips?: string[];
    department?: string | null;
    status: AttendanceStatus;
    first_event_time: string | null;
    last_event_time?: string | null;
    event_count?: number | null;
    unique_event_count?: number | null;
    explanation_text?: string | null;
    explanation_file_url?: string | null;
    explanation_updated_at?: string | null;
};
export type DailyAttendanceResponse = {
    date: string;
    workday: {
        workday_start: string;
        workday_end: string;
        late_threshold_minutes: number;
        daily_hours_norm: number;
        late_border_time: string;
    };
    summary: {
        total_tracked_users: number;
        present_on_time: number;
        late: number;
        absent: number;
        unmapped_events: number;
    };
    items: DailyAttendanceItem[];
    unmapped_events: Array<Record<string, unknown>>;
};

/** One person-day row from GET /report/period */
export type PeriodAttendanceItem = DailyAttendanceItem & {
    date: string;
};

export type PeriodAttendanceResponse = {
    date_from: string;
    date_to: string;
    app_user_id: number | null;
    events_source?: string;
    workday?: {
        workday_start?: string | null;
        workday_end?: string | null;
        late_threshold_minutes?: number | null;
        daily_hours_norm?: number | null;
    };
    items: PeriodAttendanceItem[];
};
