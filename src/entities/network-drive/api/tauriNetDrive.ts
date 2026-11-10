import { invoke, isTauri } from '@tauri-apps/api/core';

export type TauriUncEntry = {
    name: string;
    isDir: boolean;
};

export type TauriAclLine = {
    identity: string;
    icaclsIdentity: string;
    rights: string;
    access: string;
    inherited: boolean;
};

export type TauriUncTrashItem = {
    id: string;
    name: string;
    isDir: boolean;
    originalPath: string;
    deletedAt: string;
    deletedBy: string;
};

export { isTauri };

export function canUseTauriNetDrive(): boolean {
    return isTauri();
}

export async function tauriConnectShare(uncRoot: string, username: string, password: string): Promise<void> {
    return invoke('connect_unc_share', { args: { uncRoot, username, password } });
}

export async function tauriListUncChildren(path: string): Promise<TauriUncEntry[]> {
    return invoke('list_unc_entries', { path });
}

export async function tauriGetFolderAcl(path: string): Promise<TauriAclLine[]> {
    return invoke('get_folder_acl', { path });
}

export type TauriAclPermissionCode = 'F' | 'M' | 'RX' | 'R' | 'W';

export async function tauriGrantFolderAccess(
    path: string,
    account: string,
    permission: TauriAclPermissionCode,
): Promise<void> {
    return invoke('grant_folder_access', { args: { path, account, permission } });
}

export async function tauriRevokeFolderAccess(path: string, account: string): Promise<void> {
    return invoke('revoke_folder_access', { args: { path, account } });
}

export async function tauriGetFolderOwner(path: string): Promise<string> {
    return invoke('get_folder_owner', { path });
}

export async function tauriSetFolderOwner(path: string, account: string): Promise<void> {
    return invoke('set_folder_owner', { args: { path, account } });
}

export async function tauriCreateUncDir(path: string): Promise<void> {
    return invoke('create_unc_dir', { path });
}

export async function tauriWriteUncFile(path: string, bytesBase64: string): Promise<void> {
    return invoke('write_unc_file', { args: { path, bytesBase64 } });
}

export async function tauriRenameUncEntry(from: string, to: string): Promise<void> {
    return invoke('rename_unc_entry', { args: { from, to } });
}

export async function tauriCopyUncEntry(from: string, to: string): Promise<void> {
    return invoke('copy_unc_entry', { args: { from, to } });
}

export async function tauriMoveUncToTrash(
    path: string,
    shareRoot: string,
    deletedBy: string,
    deletedAt = new Date().toISOString(),
): Promise<TauriUncTrashItem> {
    return invoke('move_unc_to_trash', {
        args: { path, shareRoot, deletedBy, deletedAt },
    });
}

export async function tauriListUncTrash(shareRoot: string): Promise<TauriUncTrashItem[]> {
    return invoke('list_unc_trash', { shareRoot });
}

export async function tauriRestoreUncTrash(shareRoot: string, id: string): Promise<void> {
    return invoke('restore_unc_trash', { shareRoot, id });
}

export async function tauriPurgeUncTrash(shareRoot: string, id: string): Promise<void> {
    return invoke('purge_unc_trash', { shareRoot, id });
}

export async function fileToBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}
