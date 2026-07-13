export const TT_TIMER_LS_PREFIX = 'tt_timesheet_timer_v1:';
export const TOKEN_KEY = 'access_token';
export const MIN_ENTRY_SECONDS = 60;
export const STORAGE_KEYS = {
    auth: 'kl_tt_auth',
    timer: 'kl_tt_timer',
    lastSnapshot: 'kl_tt_last_snapshot',
} as const;

export const MSG = {
    AUTH_SYNC: 'KL_TT_AUTH_SYNC',
    AUTH_CLEAR: 'KL_TT_AUTH_CLEAR',
    TIMER_PUSH: 'KL_TT_TIMER_PUSH',
    TIMER_SYNC_FROM_PAGE: 'KL_TT_TIMER_SYNC_FROM_PAGE',
    GET_STATE: 'KL_TT_GET_STATE',
    TIMER_TOGGLE_PAUSE: 'KL_TT_TIMER_TOGGLE_PAUSE',
    TIMER_STOP: 'KL_TT_TIMER_STOP',
    TIMER_START_RECENT: 'KL_TT_TIMER_START_RECENT',
    STATE_CHANGED: 'KL_TT_STATE_CHANGED',
} as const;
