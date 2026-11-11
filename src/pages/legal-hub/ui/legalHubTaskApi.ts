import { apiFetch } from '@shared/api';
import type { MineTask } from './LegalHubMyTasks';
import type { TaskCheck, TaskComment, TaskFile, TaskHistory, TaskHistoryKind, TaskPriorityId, TaskStatusId } from './legalHubTasks';

type ApiTask = {
    id?: unknown;
    title?: unknown;
    status?: unknown;
    assigneeUserId?: unknown;
    reviewerUserId?: unknown;
    assigneeName?: unknown;
    assigneeCode?: unknown;
    projectId?: unknown;
    projectLabel?: unknown;
    priority?: unknown;
    dueOn?: unknown;
    internalOn?: unknown;
    reviewOn?: unknown;
    instructions?: unknown;
    approval?: unknown;
    boardColumn?: unknown;
    archived?: unknown;
};

type ApiStamp = { createdAt?: unknown };

const STATUSES = new Set(['partner', 'progress', 'wait', 'changes', 'associate', 'todo']);
const PRIORITIES = new Set(['high', 'normal', 'low']);
const HISTORY = new Set(['created', 'started', 'review', 'file', 'comment']);

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function stamp(value: unknown): { when: string; time: string } {
    const iso = text(value);
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return { when: '', time: '' };
    const pad = (part: number) => String(part).padStart(2, '0');
    return {
        when: `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
}

export function mineTaskFromApi(row: ApiTask): MineTask | null {
    const id = text(row.id);
    const title = text(row.title).trim();
    if (!id || !title)
        return null;
    const status = text(row.status);
    const priority = text(row.priority);
    const boardColumn = text(row.boardColumn);
    return {
        id,
        project: 'solar',
        projectId: text(row.projectId),
        projectName: text(row.projectLabel),
        title,
        workstream: '—',
        owner: 'ja1',
        assigneeId: typeof row.assigneeUserId === 'number' ? row.assigneeUserId : undefined,
        assigneeName: text(row.assigneeName),
        assigneeCode: text(row.assigneeCode),
        reviewer: row.approval === true ? 'partner' : null,
        reviewerId: typeof row.reviewerUserId === 'number' ? row.reviewerUserId : undefined,
        status: (STATUSES.has(status) ? status : 'todo') as TaskStatusId,
        priority: (PRIORITIES.has(priority) ? priority : 'normal') as TaskPriorityId,
        reviewOn: text(row.reviewOn) || null,
        clientOn: text(row.dueOn),
        minutes: 0,
        done: boardColumn === 'done',
        hours: 0,
        internalOn: text(row.internalOn),
        instructions: text(row.instructions),
        approval: row.approval === true,
        boardColumn: boardColumn || undefined,
        archived: row.archived === true,
    };
}

export async function listLegalHubTasks(): Promise<MineTask[] | null> {
    try {
        const response = await apiFetch('/api/v1/legal-hub/tasks?view=team');
        if (!response.ok)
            return null;
        const body = await response.json() as { items?: unknown };
        if (!Array.isArray(body.items))
            return null;
        return body.items.flatMap((item) => {
            const task = mineTaskFromApi(item as ApiTask);
            return task ? [task] : [];
        });
    }
    catch {
        return null;
    }
}

export async function createLegalHubTask(input: {
    title: string;
    projectId: string;
    projectLabel: string;
    assigneeUserId: number;
    assigneeName: string;
    assigneeCode: string;
    reviewerUserId?: number | null;
    status: string;
    priority: string;
    dueOn: string;
    internalOn: string;
    instructions: string;
    approval: boolean;
    boardColumn: string;
}): Promise<MineTask | null> {
    try {
        const response = await apiFetch('/api/v1/legal-hub/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: input.title,
                description: input.instructions,
                status: input.status,
                assigneeUserId: input.assigneeUserId,
                assigneeName: input.assigneeName,
                assigneeCode: input.assigneeCode,
                reviewerUserId: input.reviewerUserId ?? null,
                projectId: input.projectId,
                projectLabel: input.projectLabel,
                priority: input.priority,
                dueOn: input.dueOn || null,
                internalOn: input.internalOn || null,
                instructions: input.instructions,
                approval: input.approval,
                boardColumn: input.boardColumn,
            }),
        });
        if (!response.ok)
            return null;
        return mineTaskFromApi(await response.json() as ApiTask);
    }
    catch {
        return null;
    }
}

type ApiDetail = {
    comments?: unknown;
    files?: unknown;
    history?: unknown;
    checks?: unknown;
    createdId?: unknown;
};

export type LegalHubTaskActivity = {
    comments: TaskComment[];
    files: TaskFile[];
    history: TaskHistory[];
    checks: TaskCheck[];
};

function readFile(item: unknown): TaskFile | null {
    const row = item as { id?: unknown; name?: unknown; kind?: unknown; size?: unknown; checkId?: unknown; commentId?: unknown } & ApiStamp;
    const id = text(row.id);
    const name = text(row.name);
    if (!id || !name)
        return null;
    const when = stamp(row.createdAt);
    return {
        id,
        name,
        kind: text(row.kind) === 'pdf' ? 'pdf' : 'docx',
        size: text(row.size),
        when: when.when,
        checkId: text(row.checkId) || undefined,
        commentId: text(row.commentId) || undefined,
    };
}

function readActivity(body: ApiDetail): LegalHubTaskActivity {
    const comments = Array.isArray(body.comments) ? body.comments.flatMap((item): TaskComment[] => {
        const row = item as { id?: unknown; author?: unknown; authorUserId?: unknown; text?: unknown; files?: unknown } & ApiStamp;
        const id = text(row.id);
        const message = text(row.text);
        if (!id || !message)
            return [];
        const when = stamp(row.createdAt);
        const files = Array.isArray(row.files) ? row.files.flatMap((file) => {
            const stored = readFile(file);
            return stored ? [{ id: stored.id, name: stored.name }] : [];
        }) : [];
        return [{
            id,
            author: text(row.author),
            authorUserId: typeof row.authorUserId === 'number' ? row.authorUserId : undefined,
            text: message,
            when: when.when,
            time: when.time,
            files,
        }];
    }) : [];
    const files = Array.isArray(body.files) ? body.files.flatMap((item) => {
        const stored = readFile(item);
        return stored ? [stored] : [];
    }) : [];
    const history = Array.isArray(body.history) ? body.history.flatMap((item): TaskHistory[] => {
        const row = item as { id?: unknown; kind?: unknown; actor?: unknown; text?: unknown } & ApiStamp;
        const id = text(row.id);
        const kind = text(row.kind);
        if (!id || !HISTORY.has(kind))
            return [];
        const when = stamp(row.createdAt);
        return [{
            id,
            kind: kind as TaskHistoryKind,
            when: when.when,
            time: when.time,
            actor: text(row.actor),
            text: text(row.text),
        }];
    }) : [];
    const checks = Array.isArray(body.checks) ? body.checks.flatMap((item): TaskCheck[] => {
        const row = item as { id?: unknown; label?: unknown; done?: unknown; notes?: unknown; files?: unknown };
        const id = text(row.id);
        const label = text(row.label).trim();
        if (!id || !label)
            return [];
        const notes = Array.isArray(row.notes) ? row.notes.flatMap((note) => {
            const stored = note as { id?: unknown; text?: unknown };
            const noteId = text(stored.id);
            const noteText = text(stored.text).trim();
            return noteId && noteText ? [{ id: noteId, text: noteText }] : [];
        }) : [];
        const checkFiles = Array.isArray(row.files) ? row.files.flatMap((file) => {
            const stored = file as { id?: unknown; name?: unknown };
            const fileId = text(stored.id);
            const fileName = text(stored.name);
            return fileId && fileName ? [{ id: fileId, name: fileName }] : [];
        }) : [];
        return [{ id, label, done: row.done === true, notes, files: checkFiles }];
    }) : [];
    return { comments, files, history, checks };
}

export async function fetchLegalHubTaskActivity(taskId: string): Promise<LegalHubTaskActivity | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}`);
        if (!response.ok)
            return null;
        return readActivity(await response.json() as ApiDetail);
    }
    catch {
        return null;
    }
}

export async function patchLegalHubTask(taskId: string, patch: {
    status?: string;
    boardColumn?: string;
    reviewerUserId?: number | null;
    dueOn?: string | null;
    internalOn?: string | null;
    reviewOn?: string | null;
    clearDueOn?: boolean;
    clearInternalOn?: boolean;
    clearReviewOn?: boolean;
    notifyDates?: boolean;
    notifyReview?: boolean;
    approval?: boolean;
    archived?: boolean;
}): Promise<boolean> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}

export async function addLegalHubComment(taskId: string, message: string, attachments: File[] = []): Promise<LegalHubTaskActivity | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
        });
        if (!response.ok)
            return null;
        const body = await response.json() as ApiDetail;
        const createdId = text(body.createdId);
        if (attachments.length > 0 && createdId) {
            const uploaded = await uploadLegalHubFiles(taskId, attachments, { commentId: createdId });
            return uploaded ?? readActivity(body);
        }
        return readActivity(body);
    }
    catch {
        return null;
    }
}

export async function uploadLegalHubFiles(taskId: string, files: File[], link?: { checkId?: string; commentId?: string }): Promise<LegalHubTaskActivity | null> {
    const body = new FormData();
    for (const file of files)
        body.append('files', file);
    if (link?.checkId)
        body.append('check_id', link.checkId);
    if (link?.commentId)
        body.append('comment_id', link.commentId);
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}/files`, {
            method: 'POST',
            body,
        });
        if (!response.ok)
            return null;
        return readActivity(await response.json() as ApiDetail);
    }
    catch {
        return null;
    }
}

async function writeTask(taskId: string, path: string, method: string, payload?: unknown): Promise<LegalHubTaskActivity | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}${path}`, {
            method,
            headers: payload == null ? undefined : { 'Content-Type': 'application/json' },
            body: payload == null ? undefined : JSON.stringify(payload),
        });
        if (!response.ok)
            return null;
        return readActivity(await response.json() as ApiDetail);
    }
    catch {
        return null;
    }
}

export function addLegalHubCheck(taskId: string, label: string) {
    return writeTask(taskId, '/checks', 'POST', { label });
}

export function patchLegalHubCheck(taskId: string, checkId: string, done: boolean) {
    return writeTask(taskId, `/checks/${encodeURIComponent(checkId)}`, 'PATCH', { done });
}

export function addLegalHubCheckNote(taskId: string, checkId: string, message: string) {
    return writeTask(taskId, `/checks/${encodeURIComponent(checkId)}/notes`, 'POST', { text: message });
}

export function deleteLegalHubCheckNote(taskId: string, checkId: string, noteId: string) {
    return writeTask(taskId, `/checks/${encodeURIComponent(checkId)}/notes/${encodeURIComponent(noteId)}`, 'DELETE');
}

export async function deleteLegalHubFile(taskId: string, fileId: string): Promise<boolean> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}`, {
            method: 'DELETE',
        });
        return response.ok;
    }
    catch {
        return false;
    }
}

export async function fetchLegalHubFileBlob(taskId: string, fileId: string): Promise<Blob | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}`);
        if (!response.ok)
            return null;
        return await response.blob();
    }
    catch {
        return null;
    }
}

export async function downloadLegalHubFile(taskId: string, fileId: string, name: string): Promise<void> {
    const response = await apiFetch(`/api/v1/legal-hub/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}`);
    if (!response.ok)
        return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
}
