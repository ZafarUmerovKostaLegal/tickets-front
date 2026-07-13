export type AttendanceStatus = 'present_on_time' | 'late' | 'absent';
export type DailyAttendanceItem = {
    app_user_id: number | null;
    display_name: string;
    email: string | null;
    role: string | null;
    is_mapped?: boolean;
    camera_employee_no: string;
    camera_name: string | null;
    camera_ips?: string[];
    department?: string | null;
    status: AttendanceStatus;
    first_event_time: string | null;
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
