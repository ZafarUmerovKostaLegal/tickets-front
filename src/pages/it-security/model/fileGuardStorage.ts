import type { FileGuardStoredFile } from './fileGuardApi';

const MONTH_TITLE = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export type StorageMonthGroup = {
    key: string;
    label: string;
    bytes: number;
    files: FileGuardStoredFile[];
    openByDefault: boolean;
};

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return '0 Б';
    if (bytes < 1024)
        return `${Math.floor(bytes)} Б`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} КБ`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export function formatStorageWhen(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return '';
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function storagePersonLabel(windowsUser: string, host: string): string {
    const login = windowsUser.includes('\\') ? windowsUser.slice(windowsUser.lastIndexOf('\\') + 1) : windowsUser;
    return [login, host].filter(Boolean).join(' · ');
}

export function currentStorageMonth(now = new Date()): string {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function storageMonthKey(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return 'unknown';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function storageMonthLabel(key: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match)
        return 'Без даты';
    const title = MONTH_TITLE[Number(match[2]) - 1] ?? match[2];
    return `${title} ${match[1]}`;
}

export function filterStorageFiles(items: FileGuardStoredFile[], query: string, userId: string): FileGuardStoredFile[] {
    const text = query.trim().toLowerCase();
    const split = userId && userId !== 'all' ? userId.indexOf('|') : -1;
    const host = split >= 0 ? userId.slice(0, split) : '';
    const windowsUser = split >= 0 ? userId.slice(split + 1) : '';
    return items.filter((item) => {
        if (split >= 0) {
            const people = item.users.length > 0 ? item.users : [{ host: item.host, windowsUser: item.windowsUser }];
            const matchesUser = people.some((person) => person.host === host && person.windowsUser === windowsUser);
            if (!matchesUser)
                return false;
        }
        if (!text)
            return true;
        const haystack = [
            item.fileName,
            item.host,
            item.windowsUser,
            ...item.users.flatMap((person) => [person.host, person.windowsUser]),
        ].join(' ').toLowerCase();
        return haystack.includes(text);
    });
}

export function groupStorageByMonth(items: FileGuardStoredFile[], now = new Date()): StorageMonthGroup[] {
    const current = currentStorageMonth(now);
    const sorted = [...items].sort((left, right) => {
        const leftTime = Date.parse(left.occurredAt);
        const rightTime = Date.parse(right.occurredAt);
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
    const order: string[] = [];
    const groups = new Map<string, FileGuardStoredFile[]>();
    sorted.forEach((item) => {
        const key = storageMonthKey(item.occurredAt);
        const bucket = groups.get(key);
        if (bucket)
            bucket.push(item);
        else {
            groups.set(key, [item]);
            order.push(key);
        }
    });
    return order.map((key) => {
        const files = groups.get(key) ?? [];
        return {
            key,
            label: storageMonthLabel(key),
            bytes: files.reduce((sum, file) => sum + file.fileSize, 0),
            files,
            openByDefault: key === current,
        };
    });
}
