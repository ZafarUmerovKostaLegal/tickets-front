export const FOR_REVIEW_PRIORITY_ORDER = ['red', 'yellow', 'green'];
export function forReviewPriority(row) {
    const raw = String(row.reviewPriority ?? '').trim().toLowerCase();
    if (raw === 'red' || raw === 'yellow' || raw === 'green')
        return raw;
    return 'yellow';
}
export function forReviewPriorityRank(priority) {
    const idx = FOR_REVIEW_PRIORITY_ORDER.indexOf(priority);
    return idx >= 0 ? idx : FOR_REVIEW_PRIORITY_ORDER.indexOf('yellow');
}
/** Локальная сортировка (если сервер уже отсортировал — порядок сохранится). */
export function compareForReviewByPriority(a, b) {
    const ra = forReviewPriorityRank(forReviewPriority(a));
    const rb = forReviewPriorityRank(forReviewPriority(b));
    if (ra !== rb)
        return ra - rb;
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb)
        return ta - tb;
    return a.id.localeCompare(b.id);
}
export function countForReviewByPriority(rows) {
    const out = { red: 0, yellow: 0, green: 0 };
    for (const row of rows)
        out[forReviewPriority(row)] += 1;
    return out;
}
