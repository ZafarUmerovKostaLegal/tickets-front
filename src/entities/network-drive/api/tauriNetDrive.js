import { invoke, isTauri } from '@tauri-apps/api/core';
export { isTauri };
export function canUseTauriNetDrive() {
    return isTauri();
}
export async function tauriConnectShare(uncRoot, username, password) {
    return invoke('connect_unc_share', { args: { uncRoot, username, password } });
}
export async function tauriListUncChildren(path) {
    return invoke('list_unc_entries', { path });
}
export async function tauriGetFolderAcl(path) {
    return invoke('get_folder_acl', { path });
}
export async function tauriGrantFolderAccess(path, account, permission) {
    return invoke('grant_folder_access', { args: { path, account, permission } });
}
export async function tauriRevokeFolderAccess(path, account) {
    return invoke('revoke_folder_access', { args: { path, account } });
}
export async function tauriGetFolderOwner(path) {
    return invoke('get_folder_owner', { path });
}
export async function tauriSetFolderOwner(path, account) {
    return invoke('set_folder_owner', { args: { path, account } });
}
