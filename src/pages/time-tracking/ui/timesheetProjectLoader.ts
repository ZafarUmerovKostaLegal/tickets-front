import { upsertTimeTrackingUser, getUserProjectAccess, listAllClientProjectsForPicker, listAllTimeManagerClientsMerged, listProjectsForExpenses, } from '@entities/time-tracking';
import type { User } from '@entities/user';
export type ProjectOption = {
    id: string;
    name: string;
    client: string;
    color: string;
    clientId: string;
    currency: string;
};
function hashToColor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++)
        h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 52% 40%)`;
}
export async function loadTimesheetProjectOptions(user: User): Promise<{
    items: ProjectOption[];
    error: string | null;
}> {
    await upsertTimeTrackingUser(user);
    const access = await getUserProjectAccess(user.id);
    const allowed = new Set(access.projectIds);
    if (allowed.size === 0) {
        return { items: [], error: null };
    }
    const clients = await listAllTimeManagerClientsMerged();
    const nameById = new Map(clients.map((c) => [c.id, c.name]));
    const rows = await listAllClientProjectsForPicker();
    const items = rows
        .filter((p) => allowed.has(p.id))
        .map((p) => ({
        id: p.id,
        name: p.name,
        client: nameById.get(p.client_id) ?? '',
        clientId: p.client_id,
        color: hashToColor(p.id),
        currency: (p.currency && String(p.currency).trim()) || 'USD',
    }));
    if (allowed.size > 0 && items.length === 0) {
        return {
            items: [],
            error: 'Доступ к проектам настроен, но список не удалось загрузить. Обновите страницу или проверьте права в разделе «Проекты».',
        };
    }
    return { items, error: null };
}
export async function loadExpenseJournalProjectOptions(user: User): Promise<{
    items: ProjectOption[];
    error: string | null;
}> {
    await upsertTimeTrackingUser(user);
    try {
        const rows = await listProjectsForExpenses();
        const items = rows
            .filter((p) => !p.isArchived)
            .map((p) => ({
            id: p.id,
            name: p.name,
            client: p.clientName.trim(),
            clientId: p.clientId,
            color: hashToColor(p.id),
            currency: (p.currency && String(p.currency).trim()) || 'USD',
        }));
        return { items, error: null };
    }
    catch (e) {
        return {
            items: [],
            error: e instanceof Error
                ? e.message
                : 'Не удалось загрузить проекты для расходов. Проверьте доступ.',
        };
    }
}
