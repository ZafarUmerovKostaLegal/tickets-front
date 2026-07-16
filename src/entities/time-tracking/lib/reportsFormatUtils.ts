import { formatBillableMoney } from '@shared/lib/formatBillableMoney';
import { formatHoursClockFromDecimalHours } from '@shared/lib/formatTrackingHours';

export function fmtH(n: number | undefined | null): string {
    if (n == null || !Number.isFinite(n) || n < 0)
        return '—';
    return formatHoursClockFromDecimalHours(n);
}

export function fmtAmt(n: number | undefined | null, cur = ''): string {
    return formatBillableMoney(n, cur);
}


export function fmtAmtWithIso(n: number | undefined | null, cur: string | null | undefined): string {
    if (n == null || !Number.isFinite(n))
        return '—';
    const code = String(cur ?? '').trim().toUpperCase();
    if (!code || !/^[A-Z]{3}$/.test(code))
        return fmtAmt(n, cur ?? '');

    // UZS: amount first, ISO code after (ru-RU)
    if (code === 'UZS') {
        try {
            return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'UZS',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(n);
        }
        catch {
            return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} UZS`;
        }
    }

    // Foreign currencies: symbol before amount
    return formatBillableMoney(n, code);
}

export function sortCurrencyBuckets<T extends {
    currency?: string | null;
}>(items: T[]): T[] {
    const code = (x: T) => String(x.currency ?? '').trim().toUpperCase() || '—';
    const rank = (x: string) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
    return [...items].sort((a, b) => {
        const ca = code(a);
        const cb = code(b);
        const d = rank(ca) - rank(cb);
        return d !== 0 ? d : ca.localeCompare(cb, 'en');
    });
}

export function pct(a: number | undefined | null, b: number | undefined | null): string {
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b <= 0)
        return '—';
    return `${Math.round((a / b) * 100)}%`;
}

export function formatIsoTimeOnlyRu(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return String(iso);
    return d.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

export function formatReportWorkDate(isoDay: string): string {
    if (!isoDay)
        return '—';
    const d = new Date(`${isoDay}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return isoDay;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
