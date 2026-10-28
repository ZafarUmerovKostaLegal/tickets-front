const TT_SETTINGS_KEY = 'time-tracking-settings';
export const DEFAULT_TIME_TRACKING_SETTINGS = {
    defaultWeeklyCapacity: 35,
    defaultCurrency: 'UZS',
    weekStartsOn: 1,
    timeRoundingHours: 0.25,
};
const DEFAULT_SETTINGS = DEFAULT_TIME_TRACKING_SETTINGS;
export function getTimeTrackingSettings() {
    try {
        const raw = localStorage.getItem(TT_SETTINGS_KEY);
        if (!raw)
            return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        return {
            defaultWeeklyCapacity: typeof parsed.defaultWeeklyCapacity === 'number' && parsed.defaultWeeklyCapacity > 0
                ? parsed.defaultWeeklyCapacity
                : DEFAULT_SETTINGS.defaultWeeklyCapacity,
            defaultCurrency: parsed.defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
            weekStartsOn: parsed.weekStartsOn === 0 ? 0 : 1,
            timeRoundingHours: typeof parsed.timeRoundingHours === 'number' && parsed.timeRoundingHours > 0
                ? parsed.timeRoundingHours
                : DEFAULT_SETTINGS.timeRoundingHours,
        };
    }
    catch {
        return { ...DEFAULT_SETTINGS };
    }
}
export function setTimeTrackingSettings(value) {
    try {
        localStorage.setItem(TT_SETTINGS_KEY, JSON.stringify(value));
    }
    catch {
    }
}
