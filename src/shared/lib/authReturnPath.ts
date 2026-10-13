const AUTH_RETURN_PATH_KEY = 'auth-return-path';

function isSafeReturnPath(value: string): boolean {
    return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/auth/');
}

export function rememberAuthReturnPath(pathname: string | null | undefined, search = ''): void {
    const path = (pathname ?? '').trim();
    if (!isSafeReturnPath(path) || path === '/')
        return;
    const query = search.startsWith('?') ? search : '';
    try {
        sessionStorage.setItem(AUTH_RETURN_PATH_KEY, `${path}${query}`);
    }
    catch {
        /* private mode */
    }
}

export function consumeAuthReturnPath(): string | null {
    try {
        const value = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
        sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
        if (!value || !isSafeReturnPath(value))
            return null;
        return value;
    }
    catch {
        return null;
    }
}
