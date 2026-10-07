export function ticketStatusBucketForStats(ticketStatus, statuses) {
    const raw = (ticketStatus ?? '').trim();
    const v = raw.toLowerCase();
    const meta = statuses.find((s) => s.value === raw);
    const label = (meta?.label ?? '').toLowerCase();
    const text = `${v} ${label}`.trim();
    const impossibleRx = /невозмож|impossible|отклон|отказ|reject|cancel/i;
    const inProgressRx = /в\s*работе|прогресс|in_progress|in-progress|progress|выполня|pending/i;
    const closedRx = /закрыт|closed|resolved|done|заверш|выполнен/i;
    const notClosedRx = /не\s*закрыт/i;
    if (impossibleRx.test(label) || (v && impossibleRx.test(v)))
        return 'impossible';
    if (inProgressRx.test(label) ||
        inProgressRx.test(v) ||
        v === 'in_progress' ||
        /in_progress|in-progress/.test(v)) {
        return 'inProgress';
    }
    if (label && closedRx.test(label) && !notClosedRx.test(label))
        return 'closed';
    if (closedRx.test(v) && v !== 'open')
        return 'closed';
    if (v === 'closed')
        return 'closed';
    if (inProgressRx.test(text) && !impossibleRx.test(text))
        return 'inProgress';
    if (closedRx.test(text) && !notClosedRx.test(text) && !inProgressRx.test(label))
        return 'closed';
    if (impossibleRx.test(text))
        return 'impossible';
    return 'open';
}
export function getPriorityTagClass(priority) {
    const p = priority?.toLowerCase() || '';
    if (p === 'high')
        return 'home-tickets__priority--high';
    if (p === 'low')
        return 'home-tickets__priority--low';
    return 'home-tickets__priority--medium';
}
export function getStatusTagClass(status) {
    const s = status?.toLowerCase() || '';
    if (s === 'closed')
        return 'closed';
    if (s === 'in_progress')
        return 'in-progress';
    if (s === 'impossible' || s.includes('impossible'))
        return 'impossible';
    if (s === 'approval' || s.includes('approval') || s.includes('соглас'))
        return 'approval';
    return 'open';
}
export const TICKET_CATEGORIES = [
    'Техника',
    'Сеть',
    'Программное обеспечение',
    'Оборудование',
    'Доступы',
    'Общее',
];
export function isITRole(role) {
    if (!role)
        return false;
    return role.toLowerCase().includes('it');
}
