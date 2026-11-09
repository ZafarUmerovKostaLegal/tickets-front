export const FOLDER_COLORS = ['slate', 'ink', 'accent', 'warning', 'success', 'error'] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

export type ProjectFolder = {
    id: string;
    name: string;
    color: FolderColor;
    projectIds: string[];
    collapsed: boolean;
    clientOrder: string[];
};

export type SidebarToken =
    | { type: 'folder'; id: string }
    | { type: 'client'; name: string };

export type ProjectDisplaySettings = {
    hideLocked: boolean;
    folders: ProjectFolder[];
    sidebarOrder: SidebarToken[];
    archivedClients: string[];
    archivedProjects: string[];
};

export const EMPTY_PROJECT_DISPLAY: ProjectDisplaySettings = {
    hideLocked: false,
    folders: [],
    sidebarOrder: [],
    archivedClients: [],
    archivedProjects: [],
};

function storageKey(userId: number): string {
    return `lh-project-display-${userId}`;
}

function isColor(value: string): value is FolderColor {
    return (FOLDER_COLORS as readonly string[]).includes(value);
}

function normalizeFolder(raw: unknown): ProjectFolder | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const row = raw as Partial<ProjectFolder>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id)
        return null;
    const name = typeof row.name === 'string' ? row.name : '';
    const color = typeof row.color === 'string' && isColor(row.color) ? row.color : 'slate';
    const projectIds = Array.isArray(row.projectIds)
        ? [...new Set(row.projectIds.map((item) => String(item).trim()).filter(Boolean))]
        : [];
    return {
        id,
        name,
        color,
        projectIds,
        collapsed: row.collapsed === true,
        clientOrder: cleanNames(row.clientOrder),
    };
}

function cleanNames(raw: unknown): string[] {
    if (!Array.isArray(raw))
        return [];
    const names: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        const name = typeof item === 'string' ? item.trim().slice(0, 120) : '';
        const key = name.toLowerCase();
        if (!name || seen.has(key))
            continue;
        seen.add(key);
        names.push(name);
    }
    return names;
}

function cleanIds(raw: unknown): string[] {
    if (!Array.isArray(raw))
        return [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        const id = typeof item === 'string' ? item.trim().slice(0, 64) : '';
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}

function normalizeSidebarOrder(raw: unknown): SidebarToken[] {
    if (!Array.isArray(raw))
        return [];
    const tokens: SidebarToken[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        if (item == null || typeof item !== 'object')
            continue;
        const row = item as { type?: unknown; id?: unknown; name?: unknown };
        if (row.type === 'folder') {
            const id = typeof row.id === 'string' ? row.id.trim() : '';
            const key = `folder:${id}`;
            if (!id || seen.has(key))
                continue;
            seen.add(key);
            tokens.push({ type: 'folder', id });
            continue;
        }
        if (row.type === 'client') {
            const name = typeof row.name === 'string' ? row.name.trim().slice(0, 120) : '';
            const key = `client:${name.toLowerCase()}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            tokens.push({ type: 'client', name });
        }
    }
    return tokens;
}

export function normalizeProjectDisplay(raw: unknown): ProjectDisplaySettings {
    if (raw == null || typeof raw !== 'object')
        return EMPTY_PROJECT_DISPLAY;
    const row = raw as Partial<ProjectDisplaySettings>;
    const folders = Array.isArray(row.folders)
        ? row.folders.map(normalizeFolder).filter((folder): folder is ProjectFolder => folder != null)
        : [];
    const seen = new Set<string>();
    const unique = folders.filter((folder) => {
        if (seen.has(folder.id))
            return false;
        seen.add(folder.id);
        return true;
    });
    const owned = new Set<string>();
    const exclusive = unique.map((folder) => {
        const projectIds = folder.projectIds.filter((id) => {
            if (owned.has(id))
                return false;
            owned.add(id);
            return true;
        });
        return { ...folder, projectIds };
    });
    return {
        hideLocked: row.hideLocked === true,
        folders: exclusive,
        sidebarOrder: normalizeSidebarOrder(row.sidebarOrder),
        archivedClients: cleanNames(row.archivedClients),
        archivedProjects: cleanIds(row.archivedProjects),
    };
}

export function loadProjectDisplay(userId: number | null): ProjectDisplaySettings {
    if (userId == null)
        return EMPTY_PROJECT_DISPLAY;
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw)
            return EMPTY_PROJECT_DISPLAY;
        return normalizeProjectDisplay(JSON.parse(raw));
    }
    catch {
        return EMPTY_PROJECT_DISPLAY;
    }
}

export function saveProjectDisplay(userId: number, settings: ProjectDisplaySettings): void {
    try {
        localStorage.setItem(storageKey(userId), JSON.stringify(normalizeProjectDisplay(settings)));
    }
    catch {
        /* private mode */
    }
}

export function assignProjectToFolder(folders: ProjectFolder[], folderId: string, projectId: string, on: boolean): ProjectFolder[] {
    return folders.map((folder) => {
        const without = folder.projectIds.filter((id) => id !== projectId);
        if (folder.id !== folderId || !on)
            return { ...folder, projectIds: without };
        return { ...folder, projectIds: [...without, projectId] };
    });
}

export type ProjectGroups<T extends { id: string }> = {
    folders: { folder: ProjectFolder; projects: T[] }[];
    loose: T[];
};

export function groupProjects<T extends { id: string }>(projects: readonly T[], folders: readonly ProjectFolder[]): ProjectGroups<T> {
    const byId = new Map(projects.map((project) => [project.id, project]));
    const used = new Set<string>();
    const grouped = folders.map((folder) => {
        const items: T[] = [];
        for (const id of folder.projectIds) {
            const project = byId.get(id);
            if (project == null || used.has(id))
                continue;
            used.add(id);
            items.push(project);
        }
        return { folder, projects: items };
    });
    return {
        folders: grouped,
        loose: projects.filter((project) => !used.has(project.id)),
    };
}

export function sidebarItemKey(token: SidebarToken): string {
    return token.type === 'folder' ? `folder:${token.id}` : `client:${token.name.toLowerCase()}`;
}

export function clientGroupKey(name: string): string {
    return `client:${name.trim().toLowerCase()}`;
}

export function orderClientNames<T extends { client: string }>(groups: readonly T[], order: readonly string[]): T[] {
    const rank = new Map(order.map((name, index) => [name.trim().toLowerCase(), index]));
    return [...groups].sort((left, right) => {
        const leftRank = rank.get(left.client.trim().toLowerCase());
        const rightRank = rank.get(right.client.trim().toLowerCase());
        if (leftRank == null && rightRank == null)
            return left.client.localeCompare(right.client, 'ru');
        if (leftRank == null)
            return 1;
        if (rightRank == null)
            return -1;
        return leftRank - rightRank;
    });
}

export type SidebarEntry<T extends { client: string }> =
    | { type: 'folder'; folder: ProjectFolder; projects: T[] }
    | { type: 'client'; client: string; projects: T[] };

export function buildSidebarEntries<T extends { id: string; client: string }>(
    projects: readonly T[],
    settings: ProjectDisplaySettings,
): SidebarEntry<T>[] {
    const grouped = groupProjects(projects, settings.folders);
    const loose = new Map<string, { client: string; projects: T[] }>();
    for (const project of grouped.loose) {
        const key = project.client.trim().toLowerCase();
        const existing = loose.get(key);
        if (existing)
            existing.projects.push(project);
        else
            loose.set(key, { client: project.client.trim(), projects: [project] });
    }
    const foldersById = new Map(grouped.folders.map((item) => [item.folder.id, item]));
    const usedFolders = new Set<string>();
    const usedClients = new Set<string>();
    const entries: SidebarEntry<T>[] = [];
    for (const token of settings.sidebarOrder) {
        if (token.type === 'folder') {
            const item = foldersById.get(token.id);
            if (item == null || usedFolders.has(item.folder.id))
                continue;
            usedFolders.add(item.folder.id);
            entries.push({ type: 'folder', folder: item.folder, projects: item.projects });
            continue;
        }
        const item = loose.get(token.name.trim().toLowerCase());
        if (item == null || usedClients.has(item.client.toLowerCase()))
            continue;
        usedClients.add(item.client.toLowerCase());
        entries.push({ type: 'client', client: item.client, projects: item.projects });
    }
    for (const item of grouped.folders) {
        if (usedFolders.has(item.folder.id))
            continue;
        entries.push({ type: 'folder', folder: item.folder, projects: item.projects });
    }
    const leftover = orderClientNames([...loose.values()].filter((item) => !usedClients.has(item.client.toLowerCase())), []);
    for (const item of leftover)
        entries.push({ type: 'client', client: item.client, projects: item.projects });
    return entries;
}

function moveKey(keys: readonly string[], fromKey: string, toKey: string): string[] | null {
    const fromIndex = keys.indexOf(fromKey);
    const toIndex = keys.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex)
        return null;
    const next = [...keys];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item!);
    return next;
}

export function reorderProjectDisplay<T extends { id: string; client: string }>(
    settings: ProjectDisplaySettings,
    projects: readonly T[],
    parent: string,
    fromKey: string,
    toKey: string,
): ProjectDisplaySettings {
    if (parent === 'root') {
        const entries = buildSidebarEntries(projects, settings);
        const keys = entries.map((entry) => entry.type === 'folder' ? `folder:${entry.folder.id}` : clientGroupKey(entry.client));
        const nextKeys = moveKey(keys, fromKey, toKey);
        if (nextKeys == null)
            return settings;
        const sidebarOrder: SidebarToken[] = nextKeys.map((key) => {
            if (key.startsWith('folder:'))
                return { type: 'folder', id: key.slice('folder:'.length) };
            const entry = entries.find((item) => item.type === 'client' && clientGroupKey(item.client) === key);
            return { type: 'client', name: entry?.type === 'client' ? entry.client : key.slice('client:'.length) };
        });
        const rank = new Map(sidebarOrder.flatMap((token, index) => token.type === 'folder' ? [[token.id, index] as const] : []));
        const folders = [...settings.folders].sort((left, right) => {
            const leftRank = rank.get(left.id);
            const rightRank = rank.get(right.id);
            if (leftRank == null && rightRank == null)
                return 0;
            if (leftRank == null)
                return 1;
            if (rightRank == null)
                return -1;
            return leftRank - rightRank;
        });
        return { ...settings, folders, sidebarOrder };
    }
    const entries = buildSidebarEntries(projects, settings);
    const folderEntry = entries.find((entry) => entry.type === 'folder' && entry.folder.id === parent);
    if (folderEntry?.type !== 'folder')
        return settings;
    const groups = new Map<string, string>();
    for (const project of folderEntry.projects) {
        const name = project.client.trim();
        const key = clientGroupKey(name);
        if (!groups.has(key))
            groups.set(key, name);
    }
    const ordered = orderClientNames([...groups.entries()].map(([key, name]) => ({ key, client: name })), folderEntry.folder.clientOrder);
    const nextKeys = moveKey(ordered.map((item) => item.key), fromKey, toKey);
    if (nextKeys == null)
        return settings;
    const names = new Map(ordered.map((item) => [item.key, item.client]));
    return {
        ...settings,
        folders: settings.folders.map((folder) => folder.id === parent
            ? { ...folder, clientOrder: nextKeys.map((key) => names.get(key) ?? '') }
            : folder),
    };
}
