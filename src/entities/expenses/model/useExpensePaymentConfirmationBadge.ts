import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { fetchExpenses } from './expensesApi';

const PAYMENT_CONFIRMER_EMAIL = 'aakhmadjonov@kostalegal.com';

function formatBadge(count: number): string {
    if (count <= 0)
        return '';
    return count > 99 ? '99+' : String(count);
}

export function useExpensePaymentConfirmationBadge(enabled = true): {
    count: number;
    badge: string;
} {
    const { user } = useCurrentUser();
    const [count, setCount] = useState(0);
    const isPaymentConfirmer = (user?.email ?? '').trim().toLowerCase() === PAYMENT_CONFIRMER_EMAIL;
    const shouldTrack = enabled && isPaymentConfirmer;

    const refresh = useCallback(async () => {
        if (!shouldTrack) {
            setCount(0);
            return;
        }
        try {
            const response = await fetchExpenses({
                status: 'approved',
                scopeMode: 'company',
                isReimbursable: true,
                skip: 0,
                limit: 1,
            });
            setCount(Math.max(0, response.total));
        }
        catch {
            setCount(0);
        }
    }, [shouldTrack]);

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

    return {
        count,
        badge: useMemo(() => formatBadge(count), [count]),
    };
}
