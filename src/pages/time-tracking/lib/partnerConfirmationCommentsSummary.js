import { listPartnerConfirmationComments, } from '@entities/time-tracking';
export function summarizePartnerConfirmationComments(comments) {
    const lastComment = comments.length > 0 ? comments[comments.length - 1] ?? null : null;
    return {
        commentsCount: comments.length,
        lastComment,
    };
}
export function applyPartnerConfirmationCommentsSummary(row, summary) {
    return {
        ...row,
        commentsCount: summary.commentsCount,
        lastComment: summary.lastComment,
    };
}
export function rowNeedsPartnerConfirmationCommentsHydration(row) {
    return row.commentsCount == null;
}
const DEFAULT_CONCURRENCY = 6;
export async function hydratePartnerConfirmationCommentsSummaries(rows, options) {
    if (rows.length === 0)
        return rows;
    const onlyMissing = options?.onlyMissing !== false;
    const concurrency = Math.max(1, Math.min(options?.concurrency ?? DEFAULT_CONCURRENCY, rows.length));
    const next = rows.slice();
    const indexes = next
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !onlyMissing || rowNeedsPartnerConfirmationCommentsHydration(row));
    if (indexes.length === 0)
        return next;
    let cursor = 0;
    let stopHydration = false;
    const workers = Array.from({ length: Math.min(concurrency, indexes.length) }, async () => {
        while (cursor < indexes.length) {
            if (options?.signal?.aborted || stopHydration)
                return;
            const current = indexes[cursor++];
            if (!current)
                return;
            try {
                const comments = await listPartnerConfirmationComments(current.row.id);
                if (options?.signal?.aborted)
                    return;
                next[current.index] = applyPartnerConfirmationCommentsSummary(current.row, summarizePartnerConfirmationComments(comments));
            }
            catch (err) {
                // Mark as hydrated (0 comments) so remounts don't re-spam 404/CORS in the console.
                next[current.index] = applyPartnerConfirmationCommentsSummary(current.row, { commentsCount: 0, lastComment: null });
                const status = typeof err === 'object' && err && 'status' in err
                    ? Number(err.status)
                    : NaN;
                if (status === 404 || status === 501 || status === 502) {
                    stopHydration = true;
                }
            }
        }
    });
    await Promise.all(workers);
    return next;
}
