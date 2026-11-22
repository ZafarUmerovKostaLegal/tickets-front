const AUTH_RETURN_PATH_KEY = 'auth-return-path';

export function isSafeReturnPath(value: string): boolean {
    // Browsers read "\" as "/" — "/\evil.com" would leave the Hub (open redirect); so would control chars.
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code === 0x5c || code < 0x20 || code === 0x7f)
            return false;
    }
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
    }
}

export function consumeAuthReturnPath(): string | null {
    try {
        let value = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
        sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
        if (!value) {
            value = localStorage.getItem(AUTH_RETURN_PATH_KEY);
            localStorage.removeItem(AUTH_RETURN_PATH_KEY);
        }
        if (!value || !isSafeReturnPath(value))
            return null;
        return value;
    }
    catch {
        return null;
    }
}
