import { apiFetch } from '@shared/api';
import type { MineTask } from './LegalHubMyTasks';
import { mineTaskFromApi, readActivity, type ApiDetail, type LegalHubTaskActivity, type TaskActionId } from './legalHubTaskApi';

const BASE = '/api/v1/legal-hub';

export type TeamPerson = { id: number; name: string; email?: string; lead?: boolean };

export type TempGrant = {
    id: string;
    userId: number;
    name: string;
    email: string;
    expiresOn: string;
    grantedBy: string;
    active: boolean;
};

export type HubTeam = {
    id: string;
    name: string;
    partnerId: number;
    memberIds: number[];
    members: TeamPerson[];
    viaTemp: boolean;
    canManage: boolean;
    temps: TempGrant[];
};

export type HubTeams = { userId: number; mates: number[]; teams: HubTeam[] };

export type ProjectStage = 'todo' | 'progress' | 'wait' | 'review' | 'changes' | 'done';
export const PROJECT_STAGES: ProjectStage[] = ['todo', 'progress', 'wait', 'review', 'changes', 'done'];

export type ProjectMapRow = {
    id: string;
    name: string;
    total: number;
    done: number;
    progress: number;
    stage: ProjectStage;
    stages: Record<ProjectStage, number>;
    overdue: number;
    nextDue: string | null;
    people: number[];
    updatedAt: string;
};

export type TeamStats = {
    totals: { open: number; overdue: number; dueWeek: number; review: number; changes: number; done30: number; returned30: number };
    people: Array<{ userId: number; open: number; overdue: number; done30: number; review: number; byStage: Partial<Record<ProjectStage, number>> }>;
    projects: ProjectMapRow[];
};

/** Error text from the API (`detail`) so the user sees why an action was refused. */
async function failure(response: Response): Promise<string> {
    try {
        const body = await response.json() as { detail?: unknown };
        if (typeof body.detail === 'string' && body.detail)
            return body.detail;
    }
    catch {
        // not JSON
    }
    return `HTTP ${response.status}`;
}

async function getJson<T>(path: string): Promise<T> {
    const response = await apiFetch(`${BASE}${path}`);
    if (!response.ok)
        throw new Error(await failure(response));
    return await response.json() as T;
}

async function sendJson<T>(path: string, method: string, payload?: unknown): Promise<T> {
    const response = await apiFetch(`${BASE}${path}`, {
        method,
        headers: payload == null ? undefined : { 'Content-Type': 'application/json' },
        body: payload == null ? undefined : JSON.stringify(payload),
    });
    if (!response.ok)
        throw new Error(await failure(response));
    return await response.json() as T;
}

let teamsCache: { at: number; value: Promise<HubTeams> } | null = null;

/** Teams of the viewer (cached for a minute: the drawer and the board ask for it often). */
export function fetchHubTeams(force = false): Promise<HubTeams> {
    if (!force && teamsCache && Date.now() - teamsCache.at < 60_000)
        return teamsCache.value;
    const value = getJson<HubTeams>('/teams').catch((error: unknown) => {
        teamsCache = null;
        throw error;
    });
    teamsCache = { at: Date.now(), value };
    return value;
}

/** Everyone the viewer may hand a task to: team members, partners and active temporary members. */
export function teammates(data: HubTeams): TeamPerson[] {
    const byId = new Map<number, TeamPerson>();
    for (const team of data.teams) {
        for (const person of team.members)
            byId.set(person.id, { ...byId.get(person.id), ...person, lead: person.lead || byId.get(person.id)?.lead });
        for (const grant of team.temps) {
            if (grant.active && !byId.has(grant.userId))
                byId.set(grant.userId, { id: grant.userId, name: grant.name || grant.email, email: grant.email });
        }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function grantTempAccess(teamId: string, input: { userId: number; userName: string; userEmail: string; expiresOn: string }) {
    teamsCache = null;
    return sendJson<TempGrant>(`/teams/${encodeURIComponent(teamId)}/temp-access`, 'POST', input);
}

export function revokeTempAccess(teamId: string, grantId: string) {
    teamsCache = null;
    return sendJson<{ ok: true }>(`/teams/${encodeURIComponent(teamId)}/temp-access/${encodeURIComponent(grantId)}`, 'DELETE');
}

export function fetchProjectMap() {
    return getJson<{ stages: ProjectStage[]; projects: ProjectMapRow[] }>('/projects/map');
}

export function fetchTeamStats() {
    return getJson<TeamStats>('/stats');
}

/** Workflow step on a task; returns the updated task and its activity. Throws with the server's reason. */
export async function runTaskAction(taskId: string, action: TaskActionId, options: { comment?: string; userId?: number } = {}): Promise<{
    task: MineTask | null;
    activity: LegalHubTaskActivity;
}> {
    const body = await sendJson<ApiDetail>(`/tasks/${encodeURIComponent(taskId)}/action`, 'POST', { action, ...options });
    return { task: mineTaskFromApi(body as Parameters<typeof mineTaskFromApi>[0]), activity: readActivity(body) };
}
