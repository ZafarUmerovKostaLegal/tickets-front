export const THEME_KEY = 'appTheme';
function getSystemPrefersDark() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
        return false;
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    catch {
        return false;
    }
}
export function getInitialTheme() {
    if (typeof window === 'undefined')
        return 'light';
    try {
        const stored = window.localStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark')
            return stored;
    }
    catch {
    }
    return getSystemPrefersDark() ? 'dark' : 'light';
}
export function applyTheme(theme) {
    if (typeof document === 'undefined')
        return;
    const root = document.body;
    root.setAttribute('data-theme', theme);
    try {
        window.localStorage.setItem(THEME_KEY, theme);
    }
    catch {
    }
}
