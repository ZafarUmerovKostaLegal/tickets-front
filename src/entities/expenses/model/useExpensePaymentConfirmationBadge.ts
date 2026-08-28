import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { fetchExpenses } from './expensesApi';
import { canModerateExpenseRequests } from './expenseModeration';
import { isExpensePaymentConfirmer } from './expensePaymentConfirmer';
import { awaitingVendorPaymentQuery } from './expensesListParams';

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
} {
    const { user } = useCurrentUser();
    const [companyPayCount, setCompanyPayCount] = useState(0);
    const [clientPayCount, setClientPayCount] = useState(0);
    const [moderationCount, setModerationCount] = useState(0);
    const isPaymentConfirmer = isExpensePaymentConfirmer(user?.email);
    const isModerator = canModerateExpenseRequests(user?.role);
    const shouldTrack = enabled && user != null && (isPaymentConfirmer || isModerator);

    const refresh = useCallback(async () => {
        if (!shouldTrack) {
            setCompanyPayCount(0);
            setClientPayCount(0);
            setModerationCount(0);
            return;
        }
        try {
            const jobs: Promise<void>[] = [];
            if (isPaymentConfirmer) {
                jobs.push(
                    fetchExpenses(awaitingVendorPaymentQuery({
                        scopeMode: 'company',
                        skip: 0,
                        limit: 1,
                    })).then((response) => {
                        setCompanyPayCount(Math.max(0, response.total));
                    }),
                );
                setClientPayCount(0);
                setModerationCount(0);
            }
            else {
                setCompanyPayCount(0);
                setClientPayCount(0);
                if (isModerator) {
                    jobs.push(
                        fetchExpenses({
                            status: 'pending_approval',
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
            }
            await Promise.all(jobs);
        }
        catch {
            setCompanyPayCount(0);
            setClientPayCount(0);
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

    const payCount = companyPayCount + clientPayCount;
    const count = isPaymentConfirmer ? payCount : (payCount + moderationCount);
    return {
        payCount,
        companyPayCount,
        clientPayCount,
        moderationCount,
        count,
        badge: useMemo(() => formatBadge(count), [count]),
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
