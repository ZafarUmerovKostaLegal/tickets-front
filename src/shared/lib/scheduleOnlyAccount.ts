import { routes } from '@shared/config';

const SCHEDULE_ONLY_EMAIL = 'znurmatov@kostalegal.com';

function normalizeEmail(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function isScheduleOnlyAccountEmail(email: string | null | undefined): boolean {
    return normalizeEmail(email) === SCHEDULE_ONLY_EMAIL;
}

export function isScheduleOnlyAccount(user: { email?: string | null } | null | undefined): boolean {
    return isScheduleOnlyAccountEmail(user?.email);
}

export function scheduleOnlyLandingPath(): string {
    return `${routes.timeTracking}?tab=timesheet`;
}

export function isScheduleOnlyAllowedPath(pathname: string | null | undefined): boolean {
    const path = (pathname || '/').split('?')[0] || '/';
    if (path === routes.timeTracking)
        return true;
    if (path === routes.fileManager || path.startsWith(`${routes.fileManager}/`))
        return true;
    return false;
}
