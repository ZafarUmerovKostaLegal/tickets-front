

const HIDDEN_LOCAL_PARTS: ReadonlyArray<string> = [
    'admin',
    'info',
];


const HIDDEN_EMAILS: ReadonlySet<string> = new Set([
    'admin@local',
]);

function normalizeEmail(value: string | null | undefined): string {
    if (!value)
        return '';
    return value.trim().toLowerCase();
}

function localPart(email: string): string {
    const at = email.indexOf('@');
    return at >= 0 ? email.slice(0, at) : email;
}

function normalizeDisplayName(value: string | null | undefined): string {
    if (!value)
        return '';
    return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

const HIDDEN_DISPLAY_NAMES: ReadonlySet<string> = new Set([
    'главный администратор',
]);

export function isHiddenSystemUserEmail(email: string | null | undefined): boolean {
    const normalized = normalizeEmail(email);
    if (!normalized)
        return false;
    if (HIDDEN_EMAILS.has(normalized))
        return true;
    return HIDDEN_LOCAL_PARTS.includes(localPart(normalized));
}


export function isHiddenSystemUser(user: {
    email?: string | null;
    display_name?: string | null;
}): boolean {
    if (isHiddenSystemUserEmail(user.email))
        return true;
    return HIDDEN_DISPLAY_NAMES.has(normalizeDisplayName(user.display_name));
}
