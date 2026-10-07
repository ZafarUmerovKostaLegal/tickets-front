function apiTimeToInput(t) {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!m)
        return '09:00';
    const h = m[1].padStart(2, '0');
    const min = m[2].padStart(2, '0');
    return `${h}:${min}`;
}
function inputTimeToApi(t) {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m)
        return '09:00:00';
    const h = m[1].padStart(2, '0');
    const min = m[2].padStart(2, '0');
    return `${h}:${min}:00`;
}
export function workdayDtoToSettings(dto) {
    return {
        startTime: apiTimeToInput(dto.workday_start),
        endTime: apiTimeToInput(dto.workday_end),
        lateMinutes: dto.late_threshold_minutes,
        dailyHours: dto.daily_hours_norm,
    };
}
export function settingsToWorkdayDto(settings) {
    return {
        workday_start: inputTimeToApi(settings.startTime),
        workday_end: inputTimeToApi(settings.endTime),
        late_threshold_minutes: settings.lateMinutes,
        daily_hours_norm: settings.dailyHours,
    };
}
