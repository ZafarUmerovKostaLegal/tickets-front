const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
export function getSidebarCollapsed(): boolean {
    try {
        const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return v === '1';
    }
    catch {
        return false;
    }
}
export function setSidebarCollapsed(value: boolean) {
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0');
    }
    catch {
    }
}
