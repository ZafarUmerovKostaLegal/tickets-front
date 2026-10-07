const MARKER = '\n\n<<<KL_TODO_CARD_JSON>>>';
function extrasNonEmpty(e) {
    return !!((e.labels && e.labels.length > 0) ||
        (e.checklist && e.checklist.length > 0) ||
        (e.members && e.members.length > 0) ||
        (e.attachments && e.attachments.length > 0) ||
        (e.dueDate && e.dueDate.length > 0) ||
        (e.startDate && e.startDate.length > 0) ||
        (e.dueTime && e.dueTime.length > 0) ||
        (e.startTime && e.startTime.length > 0));
}
export function cardToExtras(card) {
    const legacyMembers = card.participantUserIds?.map(String);
    return {
        labels: card.labels?.length ? card.labels : undefined,
        dueDate: card.dueDate || undefined,
        dueTime: card.dueTime || undefined,
        startDate: card.startDate || undefined,
        startTime: card.startTime || undefined,
        checklist: card.checklist?.length ? card.checklist : undefined,
        members: legacyMembers?.length ? legacyMembers : undefined,
        attachments: card.attachments?.length ? card.attachments : undefined,
    };
}
export function splitCardBody(raw) {
    const text = raw?.trim() ?? '';
    if (!text)
        return { description: '', extras: {} };
    const idx = text.lastIndexOf(MARKER);
    if (idx < 0)
        return { description: text, extras: {} };
    const description = text.slice(0, idx).replace(/\s+$/u, '');
    const jsonPart = text.slice(idx + MARKER.length).trim();
    if (!jsonPart)
        return { description: text, extras: {} };
    try {
        const parsed = JSON.parse(jsonPart);
        if (!parsed || typeof parsed !== 'object')
            return { description: text, extras: {} };
        const o = parsed;
        const extras = {};
        if (Array.isArray(o.labels))
            extras.labels = o.labels;
        if (Array.isArray(o.checklist))
            extras.checklist = o.checklist;
        if (Array.isArray(o.members))
            extras.members = o.members;
        if (Array.isArray(o.attachments))
            extras.attachments = o.attachments;
        if (typeof o.dueDate === 'string')
            extras.dueDate = o.dueDate;
        if (typeof o.dueTime === 'string')
            extras.dueTime = o.dueTime;
        if (typeof o.startDate === 'string')
            extras.startDate = o.startDate;
        if (typeof o.startTime === 'string')
            extras.startTime = o.startTime;
        return { description, extras };
    }
    catch {
        return { description: text, extras: {} };
    }
}
export function mergeCardBody(description, extras) {
    const desc = description.replace(/\s+$/u, '');
    if (!extrasNonEmpty(extras)) {
        return desc;
    }
    const json = JSON.stringify(extras);
    return desc ? `${desc}${MARKER}${json}` : `${MARKER}${json}`;
}
