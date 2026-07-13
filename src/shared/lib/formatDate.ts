export function formatDateRu(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return iso;
    }
}
export function formatDateShort(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    catch {
        return iso;
    }
}
export function formatDateShortWithTime(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return iso;
    }
}
export function formatDateInfo(iso: string): string {
    try {
        const d = new Date(iso);
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleDateString('ru-RU', { month: 'short' });
        const year = d.getFullYear();
        const time = d.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        return `${day} ${month} ${year} ${time}`;
    }
    catch {
        return iso;
    }
}
export function formatDateOnly(iso: string | null): string {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    }
    catch {
        return iso ?? '—';
    }
}
export function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }
    catch {
        return iso;
    }
}
export function formatClockDate(d: Date): string {
    const s = d.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
export function toDateInput(iso: string | null): string {
    if (!iso)
        return '';
    try {
        return new Date(iso).toISOString().slice(0, 10);
    }
    catch {
        return '';
    }
}
export function formatDateForInput(d: Date): string {
    return d.toISOString().slice(0, 10);
}
