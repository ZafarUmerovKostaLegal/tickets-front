import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
import type { WorkdaySettingsDto } from '../model/workdaySettingsTypes';
function apiTimeToInput(t: string): string {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!m)
        return '09:00';
    const h = m[1].padStart(2, '0');
    const min = m[2].padStart(2, '0');
    return `${h}:${min}`;
}
function inputTimeToApi(t: string): string {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m)
        return '09:00:00';
    const h = m[1].padStart(2, '0');
    const min = m[2].padStart(2, '0');
    return `${h}:${min}:00`;
}
export function workdayDtoToSettings(dto: WorkdaySettingsDto): WorkdaySettings {
    return {
        startTime: apiTimeToInput(dto.workday_start),
        endTime: apiTimeToInput(dto.workday_end),
        lateMinutes: dto.late_threshold_minutes,
        dailyHours: dto.daily_hours_norm,
    };
}
export function settingsToWorkdayDto(settings: WorkdaySettings): WorkdaySettingsDto {
    return {
        workday_start: inputTimeToApi(settings.startTime),
        workday_end: inputTimeToApi(settings.endTime),
        late_threshold_minutes: settings.lateMinutes,
        daily_hours_norm: settings.dailyHours,
    };
}
