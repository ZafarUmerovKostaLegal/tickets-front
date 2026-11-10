import {
    canUseTauriNetDrive,
    fileToBase64,
    loadNetDriveSettings,
    loadSessionPassword,
    tauriConnectShare,
    tauriCopyUncEntry,
    tauriCreateUncDir,
    tauriGetFolderAcl,
    tauriGrantFolderAccess,
    tauriListUncChildren,
    tauriMoveUncToTrash,
    tauriRenameUncEntry,
    tauriRevokeFolderAccess,
    tauriWriteUncFile,
    type TauriAclLine,
    type TauriAclPermissionCode,
    type TauriUncEntry,
} from '@entities/network-drive';
import { childUncPath, pathSegmentsFromRoot, trimUnc } from '@shared/lib/uncPath';

export type NetEntry = {
    id: string;
    name: string;
    kind: 'folder' | 'file';
    path: string;
};

export type NetAclRule = {
    userId: string;
    userName: string;
    position: string;
    level: 'read' | 'edit' | 'manage' | 'deny';
    note: string;
    revokeAccount: string;
};

export function netDriveAvailable(): boolean {
    return canUseTauriNetDrive();
}

export function loadNetDriveConnection(): { unc: string; username: string; password: string } | null {
    const settings = loadNetDriveSettings();
    if (!settings?.unc.trim() || !settings.username.trim())
        return null;
    return {
        unc: trimUnc(settings.unc),
        username: settings.username.trim(),
        password: loadSessionPassword() ?? '',
    };
}

export async function connectNetDrive(): Promise<{ root: string; username: string }> {
    const cfg = loadNetDriveConnection();
    if (!cfg)
        throw new Error('needCredentials');
    await tauriConnectShare(cfg.unc, cfg.username, cfg.password);
    return { root: cfg.unc, username: cfg.username };
}

export async function listNetEntries(path: string): Promise<NetEntry[]> {
    const rows = await tauriListUncChildren(path);
    return rows
        .filter((row) => row.name !== '.' && row.name !== '..')
        .map((row) => toEntry(path, row))
        .sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name));
}

function toEntry(parent: string, row: TauriUncEntry): NetEntry {
    const path = childUncPath(parent, row.name);
    return {
        id: path,
        name: row.name,
        kind: row.isDir ? 'folder' : 'file',
        path,
    };
}

export function netCrumbs(root: string, current: string) {
    return pathSegmentsFromRoot(root, current);
}

export async function createNetFolder(parent: string, name: string): Promise<void> {
    await tauriCreateUncDir(childUncPath(parent, name));
}

export async function uploadNetFiles(parent: string, files: File[]): Promise<void> {
    for (const file of files) {
        const target = childUncPath(parent, file.name);
        const bytesBase64 = await fileToBase64(file);
        await tauriWriteUncFile(target, bytesBase64);
    }
}

export async function renameNetEntry(entry: NetEntry, nextName: string): Promise<void> {
    const parent = entry.path.slice(0, Math.max(0, entry.path.lastIndexOf('\\')));
    const to = childUncPath(parent || entry.path, nextName);
    await tauriRenameUncEntry(entry.path, to);
}

export async function deleteNetEntries(entries: NetEntry[], shareRoot: string, deletedBy: string): Promise<void> {
    for (const entry of entries)
        await tauriMoveUncToTrash(entry.path, shareRoot, deletedBy);
}

export async function moveNetEntries(entries: NetEntry[], targetDir: string): Promise<void> {
    for (const entry of entries) {
        const to = childUncPath(targetDir, entry.name);
        if (to.toLowerCase() === entry.path.toLowerCase())
            continue;
        await tauriRenameUncEntry(entry.path, to);
    }
}

export async function copyNetEntryTo(entry: NetEntry, targetDir: string, fileName: string): Promise<void> {
    await tauriCopyUncEntry(entry.path, childUncPath(targetDir, fileName));
}

export function mapAclLines(lines: TauriAclLine[]): NetAclRule[] {
    return lines.map((line) => ({
        userId: line.icaclsIdentity || line.identity,
        userName: line.identity || line.icaclsIdentity,
        position: line.inherited ? 'inherited' : 'explicit',
        level: rightsToLevel(line.rights, line.access),
        note: line.rights,
        revokeAccount: line.icaclsIdentity || line.identity,
    }));
}

function rightsToLevel(rights: string, access: string): NetAclRule['level'] {
    if (access === 'Deny')
        return 'deny';
    const r = rights.toUpperCase();
    if (r.includes('(F)') || r === 'F' || r.includes('FULL'))
        return 'manage';
    if (r.includes('(M)') || r === 'M' || r.includes('MODIFY'))
        return 'edit';
    if (r.includes('(W)'))
        return 'edit';
    return 'read';
}

export function levelToPermission(level: NetAclRule['level']): TauriAclPermissionCode {
    if (level === 'manage')
        return 'F';
    if (level === 'edit')
        return 'M';
    return 'R';
}

export async function loadNetAcl(path: string): Promise<NetAclRule[]> {
    const lines = await tauriGetFolderAcl(path);
    return mapAclLines(lines);
}

export async function grantNetAccess(path: string, account: string, level: NetAclRule['level']): Promise<void> {
    if (level === 'deny') {
        await tauriRevokeFolderAccess(path, account);
        return;
    }
    await tauriGrantFolderAccess(path, account, levelToPermission(level));
}

export async function revokeNetAccess(path: string, account: string): Promise<void> {
    await tauriRevokeFolderAccess(path, account);
}

export function uniqueChildName(existing: string[], base: string): string {
    const names = new Set(existing.map((name) => name.toLowerCase()));
    if (!names.has(base.toLowerCase()))
        return base;
    let index = 2;
    while (names.has(`${base} (${index})`.toLowerCase()))
        index += 1;
    return `${base} (${index})`;
}
