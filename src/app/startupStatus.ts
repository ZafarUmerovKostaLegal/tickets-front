export const StartupStatus = {
    Idle: 'idle',
    Checking: 'checking',
    Ready: 'ready',
    Error: 'error',
} as const;
export type StartupStatus = (typeof StartupStatus)[keyof typeof StartupStatus];
