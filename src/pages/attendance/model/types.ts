import type { AttendanceStatus } from '@entities/attendance';
export type GroupedRow = {
    key: string;
    date: string;
    name: string;
    department: string;
    firstTime: string | null;
    lastTime: string | null;
    firstCheckpoint: string;
    lastCheckpoint: string;
    status?: AttendanceStatus;
    email?: string | null;
    appUserId?: number;
    cameraEmployeeNo?: string;
    explanationText?: string | null;
    explanationFileUrl?: string | null;
    explanationUpdatedAt?: string | null;
};
export type AttendanceSummary = {
    entries: number;
    lateness: number;
    overtime: number;
    total_hours: number;
    avg_hours_per_entry: number;
    dailyMode?: boolean;
    present_on_time?: number;
    absent?: number;
    unmapped_events?: number;
};
