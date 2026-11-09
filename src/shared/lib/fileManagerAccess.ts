import { canAccessAdminPanel } from './orgRoles';

type FileManagerUser = {
    role?: string | null;
    position?: string | null;
} | null | undefined;

/** Full file-manager management: admins and partners. */
export function canManageFileManager(user: FileManagerUser): boolean {
    if (user == null)
        return false;
    return canAccessAdminPanel(user.role, user.position);
}

/** Upload is available to every signed-in user who can open the page. */
export function canUploadFileManager(user: FileManagerUser): boolean {
    return user != null;
}

/** Download is available to every signed-in user who can open the page. */
export function canDownloadFileManager(user: FileManagerUser): boolean {
    return user != null;
}
