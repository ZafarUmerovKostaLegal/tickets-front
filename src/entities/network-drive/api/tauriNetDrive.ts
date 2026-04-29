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
