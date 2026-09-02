import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { fetchExpenses } from './expensesApi';
import { canModerateExpenseRequests } from './expenseModeration';
import { isExpensePaymentConfirmer } from './expensePaymentConfirmer';
import { awaitingEmployeeReimbursementQuery } from './expensesListParams';

function formatBadge(count: number): string {
    if (count <= 0)
        return '';
    return count > 99 ? '99+' : String(count);
}

export function useExpenseAttentionBadge(enabled = true): {
    payCount: number;
    companyPayCount: number;
    clientPayCount: number;
    moderationCount: number;
    count: number;
    badge: string;
    moderationBadge: string;
    isPaymentConfirmer: boolean;
} {
    const { user } = useCurrentUser();
    const [reimbursementCount, setReimbursementCount] = useState(0);
    const [moderationCount, setModerationCount] = useState(0);
    const isPaymentConfirmer = isExpensePaymentConfirmer(user?.email, { displayName: user?.display_name });
    const isModerator = canModerateExpenseRequests(user?.role);
    const shouldTrack = enabled && user != null && (isPaymentConfirmer || isModerator);

    const refresh = useCallback(async () => {
        if (!shouldTrack) {
            setReimbursementCount(0);
            setModerationCount(0);
            return;
        }
        try {
            const jobs: Array<Promise<void>> = [];
            if (isPaymentConfirmer) {
                jobs.push(
                    fetchExpenses(awaitingEmployeeReimbursementQuery({
                        scopeMode: 'company',
                        skip: 0,
                        limit: 1,
                    })).then((response) => {
                        setReimbursementCount(Math.max(0, response.total));
                    }),
                );
            }
            else {
                setReimbursementCount(0);
            }
            if (isPaymentConfirmer || isModerator) {
                jobs.push(
                    fetchExpenses({
                        status: 'pending_approval',
                        scopeMode: 'company',
                        skip: 0,
                        limit: 1,
                    }).then((response) => {
                        setModerationCount(Math.max(0, response.total));
                    }),
                );
            }
            else {
                setModerationCount(0);
            }
            await Promise.allSettled(jobs);
        }
        catch {
            setReimbursementCount(0);
            setModerationCount(0);
        }
    }, [shouldTrack, isPaymentConfirmer, isModerator]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!shouldTrack)
            return;
        const onFocus = () => void refresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refresh, shouldTrack]);

    const count = isPaymentConfirmer ? reimbursementCount : moderationCount;
    return {
        payCount: reimbursementCount,
        companyPayCount: reimbursementCount,
        clientPayCount: 0,
        moderationCount,
        count,
        isPaymentConfirmer,
        badge: useMemo(() => formatBadge(count), [count]),
        moderationBadge: useMemo(() => formatBadge(moderationCount), [moderationCount]),
    };
}

export function useExpensePaymentConfirmationBadge(enabled = true): {
    count: number;
    badge: string;
} {
    const { payCount } = useExpenseAttentionBadge(enabled);
    return {
        count: payCount,
        badge: useMemo(() => formatBadge(payCount), [payCount]),
    };
}
