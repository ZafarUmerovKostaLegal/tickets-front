/** Name of the service initiator is stored in the note after the last "/". */
export function splitServiceInitiatorName(raw: string | null | undefined): { note: string; name: string } {
    const text = raw ?? '';
    const slash = text.lastIndexOf('/');
    if (slash < 0)
        return { note: text, name: '' };
    const name = text.slice(slash + 1).trim();
    if (!name)
        return { note: text, name: '' };
    return { note: text.slice(0, slash).trimEnd(), name };
}

export function joinServiceInitiatorName(note: string, name: string): string {
    const initiator = name.trim();
    if (!initiator)
        return note;
    const left = note.trimEnd();
    return left ? `${left} / ${initiator}` : initiator;
}
