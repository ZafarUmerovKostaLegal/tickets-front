import { listColleaguesAsUsers } from '@entities/contacts';
import { getUsers, type User } from '@entities/user';
import { isHiddenSystemUser } from '@shared/lib';

function isPickerEligible(u: User): boolean {
    return !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u);
}

export async function loadTodoDirectoryUsers(): Promise<User[]> {
    try {
        const colleagues = await listColleaguesAsUsers();
        const filtered = colleagues.filter(isPickerEligible);
        if (filtered.length > 0)
            return filtered;
    }
    catch {
        /* fall through to getUsers */
    }
    try {
        return (await getUsers(false)).filter(isPickerEligible);
    }
    catch {
        return [];
    }
}

export async function loadTodoBoardDisplayUsers(): Promise<User[]> {
    try {
        const colleagues = await listColleaguesAsUsers();
        const filtered = colleagues.filter((u) => !isHiddenSystemUser(u));
        if (filtered.length > 0)
            return filtered;
    }
    catch {
        /* fall through */
    }
    try {
        return (await getUsers(false)).filter((u) => !isHiddenSystemUser(u));
    }
    catch {
        return [];
    }
}
