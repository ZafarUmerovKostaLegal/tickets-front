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
