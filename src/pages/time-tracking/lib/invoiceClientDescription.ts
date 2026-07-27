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

const SEP_START = /^[\s:.\u2014\u2013-]+/u;

function isSafePrefixBoundary(after: string): boolean {
    if (!after)
        return false;
    const ch = after[0]!;
    if (/[\s:\n.\u2014\u2013-]/.test(ch))
        return true;
    // Glued Harvest-style: "Document ReviewЗаконодательство"
    if (ch.charCodeAt(0) > 127)
        return true;
    if (ch === ch.toUpperCase() && ch !== ch.toLowerCase())
        return true;
    return false;
}

/**
 * Client-facing invoice / unbilled description: notes only, without task name
 * (`Task\\nNotes` storage) or a leading known task label (`Document Review …`).
 * Also strips glued labels without a separator (`Document ReviewЗаконодательство`).
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
        const after = text.slice(task.length);
        if (isSafePrefixBoundary(after) || !after.trim()) {
            const rest = after.replace(SEP_START, '').trim();
            if (rest)
                text = rest;
            else if (!after.trim())
                return '';
        }
    }

    for (const prefix of PREFIXES_BY_LENGTH) {
        if (text.length <= prefix.length)
            continue;
        if (!text.toLowerCase().startsWith(prefix.toLowerCase()))
            continue;
        const after = text.slice(prefix.length);
        if (!isSafePrefixBoundary(after))
            continue;
        const rest = after.replace(SEP_START, '').trim();
        if (rest)
            return rest;
    }

    return text;
}

/** Detects a leading task label in raw time-entry or invoice-line description. */
export function detectInvoiceDescriptionTaskPrefix(raw: string | null | undefined): string {
    const base = (raw ?? '').trim();
    if (!base)
        return '';

    const { taskLine, notes } = parseTimeEntryDescription(base);
    if (notes.trim() && taskLine.trim())
        return taskLine.trim();

    for (const prefix of PREFIXES_BY_LENGTH) {
        if (base.length <= prefix.length)
            continue;
        if (!base.toLowerCase().startsWith(prefix.toLowerCase()))
            continue;
        const after = base.slice(prefix.length);
        if (!isSafePrefixBoundary(after))
            continue;
        return prefix;
    }

    return '';
}

export function normalizeNoteForDuplicateKey(
    raw: string | null | undefined,
    taskName?: string | null,
): string {
    return invoiceClientDescription(raw, taskName).trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

export function notesAreNearDuplicate(a: string, b: string, minPrefixLen = 24): boolean {
    if (a === b)
        return true;
    if (!a || !b)
        return false;
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    const core = shorter.replace(/[ ,.;:]+$/u, '');
    if (core.length < minPrefixLen)
        return false;
    return longer.startsWith(core);
}
