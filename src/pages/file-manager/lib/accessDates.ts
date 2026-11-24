export function toDay(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return '';
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function endOfDay(day: string): string | null {
    return day ? new Date(`${day}T23:59:59`).toISOString() : null;
}

export function isFuture(iso: string | null | undefined): boolean {
    return Boolean(iso) && new Date(iso!).getTime() > Date.now();
}

export function todayPlus(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toDay(date.toISOString());
}

export function shortDay(iso: string | null | undefined, locale: string): string {
    return iso ? new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
