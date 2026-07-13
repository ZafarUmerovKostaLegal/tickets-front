import type { PriorityItem } from '../model/types';

const EN_SLUG_TO_RU: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    critical: 'Критический',
};


export function normalizeTicketPriorityForApi(priority: string, priorities: PriorityItem[] = []): string {
    const raw = priority.trim();
    if (!raw)
        return resolveDefaultTicketPriority(priorities);

    const fromList = priorities.find((p) => p.value === raw || p.label === raw);
    if (fromList)
        return fromList.value;

    const ruFromSlug = EN_SLUG_TO_RU[raw.toLowerCase()];
    if (ruFromSlug) {
        const fromListRu = priorities.find((p) => p.value === ruFromSlug || p.label === ruFromSlug);
        if (fromListRu)
            return fromListRu.value;
        return ruFromSlug;
    }

    return raw;
}

export function resolveDefaultTicketPriority(priorities: PriorityItem[] = []): string {
    if (priorities.length > 0) {
        const medium = priorities.find((p) => p.value.toLowerCase() === 'medium'
            || /средн/i.test(p.value)
            || /средн/i.test(p.label));
        if (medium)
            return medium.value;
        return priorities[0]!.value;
    }
    return 'Средний';
}


export function coerceTicketFormPriority(current: string, priorities: PriorityItem[]): string {
    const normalized = normalizeTicketPriorityForApi(current, priorities);
    if (priorities.length > 0 && !priorities.some((p) => p.value === normalized))
        return resolveDefaultTicketPriority(priorities);
    return normalized;
}
