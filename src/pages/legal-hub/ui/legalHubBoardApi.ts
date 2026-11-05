import { apiFetch } from '@shared/api';
import {
    loadProjectDisplay,
    normalizeProjectDisplay,
    saveProjectDisplay,
    type ProjectDisplaySettings,
} from './legalHubProjectDisplay';

export type BoardColumnSettings = {
    custom: { id: string; title: string }[];
    order: string[];
    collapsed: string[];
};

export type BoardFilterSettings = {
    scope: string;
    onlyLate: boolean;
    onlyUrgent: boolean;
    project: string;
    status: string;
    stream: string;
    owner: string;
    priority: string;
};

export type LegalHubBoardDocument = {
    columns: BoardColumnSettings;
    folders: ProjectDisplaySettings;
    filters: BoardFilterSettings[];
};

const EMPTY_COLUMNS: BoardColumnSettings = { custom: [], order: [], collapsed: ['done'] };

function emptyFilter(scope: string): BoardFilterSettings {
    return {
        scope,
        onlyLate: false,
        onlyUrgent: false,
        project: '',
        status: '',
        stream: '',
        owner: '',
        priority: '',
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function normalizeBoardDocument(raw: unknown): LegalHubBoardDocument {
    const body = asRecord(raw);
    const columns = asRecord(body.columns);
    const custom = Array.isArray(columns.custom)
        ? columns.custom.flatMap((item) => {
            const row = asRecord(item);
            const id = typeof row.id === 'string' ? row.id.trim() : '';
            const title = typeof row.title === 'string' ? row.title.trim() : '';
            return id && title ? [{ id, title }] : [];
        })
        : [];
    return {
        columns: {
            custom,
            order: Array.isArray(columns.order) ? columns.order.filter((id): id is string => typeof id === 'string' && id.trim() !== '') : [],
            collapsed: Array.isArray(columns.collapsed) ? columns.collapsed.filter((id): id is string => typeof id === 'string' && id.trim() !== '') : ['done'],
        },
        folders: normalizeProjectDisplay(body.folders),
        filters: Array.isArray(body.filters)
            ? body.filters.flatMap((item) => {
                const row = asRecord(item);
                const scope = typeof row.scope === 'string' ? row.scope.trim() : '';
                if (!scope)
                    return [];
                return [{
                    ...emptyFilter(scope),
                    onlyLate: row.onlyLate === true,
                    onlyUrgent: row.onlyUrgent === true,
                    project: typeof row.project === 'string' ? row.project : '',
                    status: typeof row.status === 'string' ? row.status : '',
                    stream: typeof row.stream === 'string' ? row.stream : '',
                    owner: typeof row.owner === 'string' ? row.owner : '',
                    priority: typeof row.priority === 'string' ? row.priority : '',
                }];
            })
            : [],
    };
}

export function boardFilterScope(mode: 'mine' | 'queue', scope: string | null): string {
    if (mode === 'queue')
        return 'queue';
    const projectScope = scope?.trim() ?? '';
    if (projectScope)
        return `project:${projectScope}`;
    return 'mine';
}

let snapshot: LegalHubBoardDocument | null = null;
let loading: Promise<LegalHubBoardDocument | null> | null = null;
let columnQueue: Promise<void> = Promise.resolve();
let folderQueue: Promise<void> = Promise.resolve();

export function fetchLegalHubBoard(): Promise<LegalHubBoardDocument | null> {
    if (snapshot)
        return Promise.resolve(snapshot);
    if (!loading) {
        loading = (async () => {
            try {
                const response = await apiFetch('/api/v1/legal-hub/board');
                if (!response.ok)
                    return null;
                snapshot = normalizeBoardDocument(await response.json());
                return snapshot;
            }
            catch {
                return null;
            }
            finally {
                loading = null;
            }
        })();
    }
    return loading;
}

async function putBoard(path: string, body: unknown): Promise<boolean> {
    try {
        const response = await apiFetch(path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}

export function saveLegalHubColumns(columns: BoardColumnSettings): Promise<void> {
    const payload = columns;
    columnQueue = columnQueue.then(async () => {
        const saved = await putBoard('/api/v1/legal-hub/board/columns', payload);
        if (saved && snapshot)
            snapshot = { ...snapshot, columns: payload };
    });
    return columnQueue;
}

export function saveLegalHubFolders(userId: number, folders: ProjectDisplaySettings): Promise<void> {
    const payload = normalizeProjectDisplay(folders);
    saveProjectDisplay(userId, payload);
    folderQueue = folderQueue.then(async () => {
        const saved = await putBoard('/api/v1/legal-hub/board/folders', payload);
        if (saved && snapshot)
            snapshot = { ...snapshot, folders: payload };
    });
    return folderQueue;
}

export async function saveLegalHubFilters(filters: BoardFilterSettings): Promise<void> {
    const saved = await putBoard('/api/v1/legal-hub/board/filters', filters);
    if (!saved || !snapshot)
        return;
    snapshot = {
        ...snapshot,
        filters: [...snapshot.filters.filter((item) => item.scope !== filters.scope), filters],
    };
}

export function cachedBoardFolders(userId: number | null): ProjectDisplaySettings {
    if (snapshot)
        return snapshot.folders;
    return loadProjectDisplay(userId);
}

export function cachedBoardColumns(): BoardColumnSettings {
    return snapshot?.columns ?? EMPTY_COLUMNS;
}

export function cachedBoardFilter(scope: string): BoardFilterSettings | null {
    return snapshot?.filters.find((item) => item.scope === scope) ?? null;
}
