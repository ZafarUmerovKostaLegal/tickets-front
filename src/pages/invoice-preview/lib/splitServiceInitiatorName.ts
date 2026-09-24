const INITIATOR_MARKS = ['/', '*', '='] as const;

export type ServiceInitiatorMark = (typeof INITIATOR_MARKS)[number];

/** Name of the service initiator is stored in the note after the last "/", "*" or "=". */
export function splitServiceInitiatorName(raw: string | null | undefined): {
    note: string;
    name: string;
    mark: ServiceInitiatorMark;
} {
    const text = raw ?? '';
    let at = -1;
    let mark: ServiceInitiatorMark = '/';
    for (const candidate of INITIATOR_MARKS) {
        const index = text.lastIndexOf(candidate);
        if (index > at) {
            at = index;
            mark = candidate;
        }
    }
    if (at < 0)
        return { note: text, name: '', mark: '/' };
    const name = text.slice(at + 1).trim();
    if (!name)
        return { note: text, name: '', mark: '/' };
    return { note: text.slice(0, at).trimEnd(), name, mark };
}

export function joinServiceInitiatorName(
    note: string,
    name: string,
    mark: ServiceInitiatorMark = '/',
): string {
    const initiator = name.trim();
    if (!initiator)
        return note;
    const left = note.trimEnd();
    return left ? `${left} ${mark} ${initiator}` : initiator;
}
