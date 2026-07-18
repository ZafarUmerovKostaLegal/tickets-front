import {
    parseTimeEntryDescription,
    resolveTimeEntryNotesOnly,
} from '@entities/time-tracking/lib/timesheetTimerPersist';

/** Default project task labels that must not appear in client-facing invoice descriptions. */
export const INVOICE_DESCRIPTION_TASK_PREFIXES = [
    'Court Hearing Preparation',
    'Court Hearing',
    'Document Submission',
    'Document Review',
    'Drafting Documents',
    'Drafting',
    'Telephone calls',
    'My mehnat registration',
    'Kosta Legal Internal',
    'Business Development',
    'Other research',
    'Review new legislation',
    'Emails',
    'Meetings',
    'Research',
    'Accounting',
    'Lunch/Dinner',
    'Proposals',
    'Publications',
] as const;

const PREFIXES_BY_LENGTH = [...INVOICE_DESCRIPTION_TASK_PREFIXES].sort((a, b) => b.length - a.length);

/**
 * Client-facing invoice / unbilled description: notes only, without task name
 * (`Task\\nNotes` storage) or a leading known task label (`Document Review …`).
 */
export function invoiceClientDescription(
    raw: string | null | undefined,
    taskName?: string | null,
): string {
    const fromNotes = resolveTimeEntryNotesOnly(raw, taskName);
    const base = (fromNotes || (raw ?? '')).trim();
    if (!base)
        return '';

    const { notes } = parseTimeEntryDescription(base);
    if (notes.trim())
        return notes.trim();

    const task = (taskName ?? '').trim();
    let text = base;
    if (task && text.toLowerCase().startsWith(task.toLowerCase())) {
        const rest = text.slice(task.length).replace(/^[\s:.—–\-–]+/u, '').trim();
        if (rest)
            text = rest;
    }

    for (const prefix of PREFIXES_BY_LENGTH) {
        if (text.length <= prefix.length)
            continue;
        if (!text.toLowerCase().startsWith(prefix.toLowerCase()))
            continue;
        const after = text.slice(prefix.length);
        if (!/^[\s:.—–\-–]/u.test(after) && after[0] !== '\n')
            continue;
        const rest = after.replace(/^[\s:.—–\-–]+/u, '').trim();
        if (rest)
            return rest;
    }

    return text;
}
