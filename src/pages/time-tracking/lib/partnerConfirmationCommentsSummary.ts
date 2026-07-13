import {
    listPartnerConfirmationComments,
    type PartnerConfirmedReportComment,
    type PartnerReportConfirmationRequest,
} from '@entities/time-tracking';

export type PartnerConfirmationCommentsSummary = {
    commentsCount: number;
    lastComment: PartnerConfirmedReportComment | null;
};

export function summarizePartnerConfirmationComments(
    comments: ReadonlyArray<PartnerConfirmedReportComment>,
): PartnerConfirmationCommentsSummary {
    const lastComment = comments.length > 0 ? comments[comments.length - 1] ?? null : null;
    return {
        commentsCount: comments.length,
        lastComment,
    };
}

export function applyPartnerConfirmationCommentsSummary(
    row: PartnerReportConfirmationRequest,
    summary: PartnerConfirmationCommentsSummary,
): PartnerReportConfirmationRequest {
    return {
        ...row,
        commentsCount: summary.commentsCount,
        lastComment: summary.lastComment,
    };
}

export function rowNeedsPartnerConfirmationCommentsHydration(
    row: PartnerReportConfirmationRequest,
): boolean {
    return row.commentsCount == null;
}

const DEFAULT_CONCURRENCY = 6;

export async function hydratePartnerConfirmationCommentsSummaries(
    rows: PartnerReportConfirmationRequest[],
    options?: {
        concurrency?: number;
        onlyMissing?: boolean;
        signal?: AbortSignal;
    },
): Promise<PartnerReportConfirmationRequest[]> {
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
    const workers = Array.from({ length: Math.min(concurrency, indexes.length) }, async () => {
        while (cursor < indexes.length) {
            if (options?.signal?.aborted)
                return;
            const current = indexes[cursor++];
            if (!current)
                return;
            try {
                const comments = await listPartnerConfirmationComments(current.row.id);
                if (options?.signal?.aborted)
                    return;
                next[current.index] = applyPartnerConfirmationCommentsSummary(
                    current.row,
                    summarizePartnerConfirmationComments(comments),
                );
            }
            catch {
            }
        }
    });
    await Promise.all(workers);
    return next;
}
