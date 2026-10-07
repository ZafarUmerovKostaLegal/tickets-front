export const PROJECTS_FILTERS_STORAGE_KEY = 'tt-projects-filters-v1';
const STATUSES = new Set(['active', 'paused', 'archived', '']);
function asString(v) {
    return typeof v === 'string' ? v : '';
}
export function readProjectsFiltersFromStorage() {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(PROJECTS_FILTERS_STORAGE_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw);
        if (o?.v !== 1)
            return null;
        const statusRaw = asString(o.statusFilter);
        const statusFilter = (STATUSES.has(statusRaw) ? statusRaw : 'active');
        return {
            v: 1,
            statusFilter,
            searchQuery: asString(o.searchQuery),
            clientFilter: asString(o.clientFilter),
            managerFilter: asString(o.managerFilter),
            partnerFilter: asString(o.partnerFilter),
        };
    }
    catch {
        return null;
    }
}
export function writeProjectsFiltersToStorage(p) {
    if (typeof window === 'undefined')
        return;
    try {
        const payload = { v: 1, ...p };
        window.localStorage.setItem(PROJECTS_FILTERS_STORAGE_KEY, JSON.stringify(payload));
    }
    catch {
        /* quota / private mode */
    }
}
export function readInitialProjectsFilters() {
    const saved = readProjectsFiltersFromStorage();
    return {
        statusFilter: saved?.statusFilter ?? 'active',
        searchQuery: saved?.searchQuery ?? '',
        clientFilter: saved?.clientFilter ?? '',
        managerFilter: saved?.managerFilter ?? '',
        partnerFilter: saved?.partnerFilter ?? '',
    };
}
