export const TASK_PROJECTS = ['solar', 'wind', 'healthcare', 'infrastructure', 'bess'] as const;
export type TaskProjectId = (typeof TASK_PROJECTS)[number];

export const TASK_STATUSES = ['partner', 'progress', 'wait', 'changes', 'associate', 'todo'] as const;
export type TaskStatusId = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['high', 'normal'] as const;
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
    autoRouted?: boolean;
};

export const PROJECT_LABEL: Record<TaskProjectId, string> = {
    solar: 'Solar',
    wind: 'Wind',
    healthcare: 'Healthcare',
    infrastructure: 'Infrastructure',
    bess: 'BESS',
};

export const PERSON_LABEL: Record<TaskPersonId, { code: string; name: string }> = {
    ja1: { code: 'JA1', name: 'Junior Associate 1' },
    ja2: { code: 'JA2', name: 'Junior Associate 2' },
    ja3: { code: 'JA3', name: 'Junior Associate 3' },
    a1: { code: 'A1', name: 'Associate 1' },
    a2: { code: 'A2', name: 'Associate 2' },
    partner: { code: 'P', name: 'Partner' },
};

export type TaskCheck = { id: string; label: string; done: boolean };
export type TaskFile = { id: string; name: string; kind: 'pdf' | 'docx'; size: string; when: string };
export type TaskComment = { id: string; author: string; text: string; when: string };
export type TaskHistoryKind = 'created' | 'status';
export type TaskHistory = { id: string; kind: TaskHistoryKind; when: string };

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

function shiftIso(iso: string, days: number): string {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    date.setDate(date.getDate() + days);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function taskDrawerDetail(task: HubTask): TaskDetail {
    if (task.id === 'lla-prep') {
        return {
            internalOn: '2026-10-31',
            important: true,
            approval: 'required',
            instructions: 'Prepare revised LLA, verify easement provisions and relevant schedules. Include updated map and reference to land plot coordinates.',
            checks: [
                { id: 'instructions', label: 'Review client instructions', done: true },
                { id: 'draft', label: 'Prepare draft', done: true },
                { id: 'refs', label: 'Check legal references', done: false },
                { id: 'final', label: 'Verify final version', done: false },
            ],
            files: [
                { id: 'draft', name: 'LLA_draft_v2.pdf', kind: 'pdf', size: '245 KB', when: '27 Oct' },
                { id: 'comments', name: 'Client_comments.docx', kind: 'docx', size: '1.2 MB', when: '26 Oct' },
            ],
            comments: [
                { id: 'c1', author: 'Partner', text: 'Align the plan with the updated land plot coordinates before the next review.', when: '27 Oct' },
            ],
            history: [
                { id: 'h1', kind: 'created', when: '20 Oct' },
                { id: 'h2', kind: 'status', when: '27 Oct' },
            ],
        };
    }
    const doneCount = task.status === 'todo' ? 0 : task.status === 'progress' || task.status === 'wait' ? 1 : 2;
    const checks = [
        'Review client instructions',
        'Prepare draft',
        'Check legal references',
        'Verify final version',
    ].map((label, index) => ({ id: `${task.id}-${index}`, label, done: index < doneCount }));
    return {
        internalOn: shiftIso(task.clientOn, -3),
        important: task.priority === 'high',
        approval: task.priority === 'high' ? 'required' : 'none',
        instructions: `${task.title}. Check the workstream materials and leave the next step in the note before review.`,
        checks,
        files: task.status === 'todo' ? [] : [
            { id: `${task.id}-file`, name: `${task.project}_draft.pdf`, kind: 'pdf', size: '180 KB', when: '27 Oct' },
        ],
        comments: [],
        history: [
            { id: `${task.id}-created`, kind: 'created', when: '20 Oct' },
            { id: `${task.id}-status`, kind: 'status', when: '27 Oct' },
        ],
    };
}

export function tasksForMember(memberId: number, memberIds: number[]): HubTask[] {
    const ordered = [...new Set(memberIds)].sort((a, b) => a - b);
    const index = ordered.indexOf(memberId);
    if (index < 0)
        return [];
    return HUB_TASKS.filter((_, taskIndex) => taskIndex % ordered.length === index);
}

export const HUB_TASKS: HubTask[] = [
    { id: 'lla-final', project: 'solar', title: 'LLA Amendment — Final Approval', workstream: 'Land / LLA', owner: 'ja1', reviewer: 'partner', status: 'partner', priority: 'high', reviewOn: '2026-10-29', clientOn: '2026-11-02', minutes: 120 },
    { id: 'lla-prep', project: 'solar', title: 'Prepare LLA Amendment', workstream: 'Land / LLA', owner: 'ja1', reviewer: null, status: 'progress', priority: 'high', reviewOn: null, clientOn: '2026-11-03', minutes: 120 },
    { id: 'wind-final', project: 'wind', title: 'Final review before sending', workstream: 'Correspondence', owner: 'ja1', reviewer: 'partner', status: 'partner', priority: 'high', reviewOn: '2026-11-01', clientOn: '2026-11-03', minutes: 60 },
    { id: 'wind-easement', project: 'wind', title: 'Easement Schedule — Direct Review', workstream: 'Easements', owner: 'ja2', reviewer: 'partner', status: 'partner', priority: 'high', reviewOn: '2026-11-01', clientOn: '2026-11-03', minutes: 60 },
    { id: 'land-note', project: 'solar', title: 'Land rights note', workstream: 'Land / LLA', owner: 'a2', reviewer: null, status: 'progress', priority: 'high', reviewOn: null, clientOn: '2026-11-03', minutes: 60 },
    { id: 'strategy', project: 'healthcare', title: 'Client Strategy Note', workstream: 'Management', owner: 'partner', reviewer: null, status: 'progress', priority: 'high', reviewOn: null, clientOn: '2026-11-03', minutes: 60 },
    { id: 'khokimiyat', project: 'solar', title: 'Khokimiyat Land Confirmation', workstream: 'Permits', owner: 'ja1', reviewer: null, status: 'wait', priority: 'high', reviewOn: null, clientOn: '2026-11-04', minutes: 60 },
    { id: 'revise-draft', project: 'infrastructure', title: 'Revise draft based on comments', workstream: 'Legal Opinion', owner: 'ja1', reviewer: 'a1', status: 'changes', priority: 'high', reviewOn: null, clientOn: '2026-11-04', minutes: 60 },
    { id: 'bess-review', project: 'bess', title: 'BESS Lease Agreement — Review', workstream: 'Land / LLA', owner: 'ja1', reviewer: 'a1', status: 'associate', priority: 'high', reviewOn: '2026-10-31', clientOn: '2026-11-04', minutes: 120 },
    { id: 'easement-assoc', project: 'wind', title: 'Easement Agreement — Associate Review', workstream: 'Easements', owner: 'ja2', reviewer: 'a1', status: 'associate', priority: 'high', reviewOn: '2026-10-31', clientOn: '2026-11-04', minutes: 90 },
    { id: 'gov-letter', project: 'infrastructure', title: 'Government Response Letter', workstream: 'Compliance', owner: 'ja3', reviewer: 'partner', status: 'partner', priority: 'high', reviewOn: '2026-10-31', clientOn: '2026-11-04', minutes: 60, autoRouted: true },
    { id: 'bess-final', project: 'bess', title: 'BESS Lease — Final Approval', workstream: 'Land', owner: 'ja3', reviewer: 'partner', status: 'partner', priority: 'high', reviewOn: '2026-11-02', clientOn: '2026-11-04', minutes: 90 },
    { id: 'regulator', project: 'infrastructure', title: 'Regulator confirmation', workstream: 'Permits', owner: 'a1', reviewer: null, status: 'wait', priority: 'normal', reviewOn: null, clientOn: '2026-11-04', minutes: 60 },
    { id: 'allocation', project: 'solar', title: 'Letter on Land Allocation', workstream: 'Correspondence', owner: 'ja1', reviewer: null, status: 'wait', priority: 'normal', reviewOn: null, clientOn: '2026-11-05', minutes: 60 },
    { id: 'schedule', project: 'wind', title: 'Prepare contract schedule', workstream: 'Contracts', owner: 'ja1', reviewer: null, status: 'todo', priority: 'normal', reviewOn: null, clientOn: '2026-11-05', minutes: 90 },
];
