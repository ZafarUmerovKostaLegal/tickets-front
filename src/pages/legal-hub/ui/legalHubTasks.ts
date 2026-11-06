export const TASK_PROJECTS = ['solar', 'wind', 'healthcare', 'infrastructure', 'bess'] as const;
export type TaskProjectId = (typeof TASK_PROJECTS)[number];

export const TASK_STATUSES = ['partner', 'progress', 'wait', 'changes', 'associate', 'todo'] as const;
export type TaskStatusId = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['high', 'normal', 'low'] as const;
export type TaskPriorityId = (typeof TASK_PRIORITIES)[number];

export const TASK_PEOPLE = ['ja1', 'ja2', 'ja3', 'a1', 'a2', 'partner'] as const;
export type TaskPersonId = (typeof TASK_PEOPLE)[number];

export type HubTask = {
    id: string;
    project: TaskProjectId;
    title: string;
    workstream: string;
    owner: TaskPersonId;
    reviewer: TaskPersonId | null;
    status: TaskStatusId;
    priority: TaskPriorityId;
    reviewOn: string | null;
    clientOn: string;
    minutes: number;
    /** Real project from time tracking. Mock ids stay in `project`. */
    projectId?: string;
    projectName?: string;
    assigneeId?: number;
    assigneeName?: string;
    assigneeCode?: string;
    autoRouted?: boolean;
    important?: boolean;
    waitingFor?: string;
    followUpOn?: string | null;
};

export const PROJECT_LABEL: Record<TaskProjectId, string> = {
    solar: 'Solar',
    wind: 'Wind',
    healthcare: 'Healthcare',
    infrastructure: 'Infrastructure',
    bess: 'BESS',
};

export const PROJECT_TITLE: Record<TaskProjectId, string> = {
    solar: 'Project A — Solar',
    wind: 'Project B — Wind',
    infrastructure: 'Project C — Infrastructure',
    bess: 'Project D — BESS',
    healthcare: 'Project E — Healthcare',
};

export const MOCK_DONE_IDS: readonly string[] = [];

export function taskProjectName(task: Pick<HubTask, 'project' | 'projectName'>): string {
    const named = task.projectName?.trim();
    if (named)
        return named;
    return isTaskProjectId(task.project) ? PROJECT_TITLE[task.project] : task.project;
}

export function taskOwnerLabel(task: Pick<HubTask, 'owner' | 'assigneeName' | 'assigneeCode'>): { name: string; code: string } {
    const named = task.assigneeName?.trim();
    if (named) {
        const code = task.assigneeCode?.trim() || named.slice(0, 2).toUpperCase();
        return { name: named, code };
    }
    if ((TASK_PEOPLE as readonly string[]).includes(task.owner))
        return PERSON_LABEL[task.owner];
    return { name: task.owner, code: task.owner.slice(0, 2).toUpperCase() };
}

export function isTaskProjectId(value: string | null | undefined): value is TaskProjectId {
    return value != null && (TASK_PROJECTS as readonly string[]).includes(value);
}

export const PERSON_LABEL: Record<TaskPersonId, { code: string; name: string }> = {
    ja1: { code: 'JA1', name: 'Junior Associate 1' },
    ja2: { code: 'JA2', name: 'Junior Associate 2' },
    ja3: { code: 'JA3', name: 'Junior Associate 3' },
    a1: { code: 'A1', name: 'Associate 1' },
    a2: { code: 'A2', name: 'Associate 2' },
    partner: { code: 'P', name: 'Partner' },
};

export type TaskCheckNote = { id: string; text: string };
export type TaskCheckFile = { id: string; name: string };
export type TaskCheck = { id: string; label: string; done: boolean; notes?: TaskCheckNote[]; files?: TaskCheckFile[] };
export type TaskFile = { id: string; name: string; kind: 'pdf' | 'docx'; size: string; when: string };
export type TaskComment = { id: string; author: string; authorUserId?: number; text: string; when: string; time: string; mine?: boolean };
export type TaskHistoryKind = 'created' | 'started' | 'review' | 'file' | 'comment';
export type TaskHistory = { id: string; kind: TaskHistoryKind; when: string; time: string; actor?: string; text?: string };

export type TaskDetail = {
    internalOn: string | null;
    important: boolean;
    approval: 'required' | 'none';
    instructions: string;
    checks: TaskCheck[];
    files: TaskFile[];
    comments: TaskComment[];
    history: TaskHistory[];
};

export function taskDrawerDetail(task: HubTask): TaskDetail {
    return {
        internalOn: '',
        important: task.priority === 'high',
        approval: task.priority === 'high' ? 'required' : 'none',
        instructions: '',
        checks: [],
        files: [],
        comments: [],
        history: [],
    };
}

export function tasksForMember(memberId: number, memberIds: number[]): HubTask[] {
    const ordered = [...new Set(memberIds)].sort((a, b) => a - b);
    const index = ordered.indexOf(memberId);
    if (index < 0)
        return [];
    return HUB_TASKS.filter((_, taskIndex) => taskIndex % ordered.length === index);
}

export const HUB_TASKS: HubTask[] = [];
