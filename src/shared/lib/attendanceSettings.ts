export type WorkdaySettings = {
    startTime: string;
    endTime: string;
    lateMinutes: number;
    dailyHours: number;
};
export const DEFAULT_WORKDAY_SETTINGS: WorkdaySettings = {
    startTime: '09:00',
    endTime: '18:00',
    lateMinutes: 15,
    dailyHours: 8,
};
