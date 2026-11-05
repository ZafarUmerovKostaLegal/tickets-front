export const FOLDER_COLORS = ['slate', 'ink', 'accent', 'warning', 'success', 'error'] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

export type ProjectFolder = {
    id: string;
    name: string;
    color: FolderColor;
    projectIds: string[];
    collapsed: boolean;
};

export type ProjectDisplaySettings = {
    hideLocked: boolean;
    folders: ProjectFolder[];
};

export const EMPTY_PROJECT_DISPLAY: ProjectDisplaySettings = {
    hideLocked: false,
    folders: [],
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
    };
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
