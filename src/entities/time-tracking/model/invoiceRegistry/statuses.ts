export const INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'На согласовании с Клиентом',
    'Выставлен',
    'Оплачен',
    'Ольге направить',
] as const;

export type InvoiceRegistryStatus = (typeof INVOICE_REGISTRY_STATUSES)[number];

export const SYSTEM_INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'На согласовании с Клиентом',
    'Отправлен',
    'Выставлен',
    'Оплата в пути',
    'Частично оплачен',
    'Оплачен',
    'Ольге направить',
    'Просрочен',
    'Отменён',
] as const;

export function isInvoiceRegistryStatus(value: string): value is InvoiceRegistryStatus {
    return (INVOICE_REGISTRY_STATUSES as readonly string[]).includes(value);
}

export const LEGACY_INVOICE_REGISTRY_STATUSES = [
    'Аннулирован',
] as const;

const HIDDEN_REGISTRY_STATUSES = new Set([
    'попросил выставить в октябре',
    'просмотрен',
]);

const REGISTRY_STATUS_ALIASES: Record<string, string> = {
    'ольге направила': 'Ольге направить',
    'жду подтверждения от клиента': 'Жду подтверждения от клиента',
    'оплачен клиентом': 'Оплачен',
};

function registryStatusKey(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim().replace(/\.+$/g, '').toLowerCase();
}

export function normalizeRegistryStatusLabel(raw: string): string {
    const value = raw.replace(/\s+/g, ' ').trim().replace(/\.+$/g, '');
    if (!value)
        return '';
    const alias = REGISTRY_STATUS_ALIASES[registryStatusKey(value)];
    const text = alias ?? value;
    const first = text.charAt(0);
    const upper = first.toLocaleUpperCase('ru');
    return first === upper ? text : upper + text.slice(1);
}

export function collectRegistryStatusOptions(used: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw: string) => {
        const value = normalizeRegistryStatusLabel(raw);
        if (!value || seen.has(value) || HIDDEN_REGISTRY_STATUSES.has(registryStatusKey(value)))
            return;
        seen.add(value);
        out.push(value);
    };
    for (const status of INVOICE_REGISTRY_STATUSES)
        push(status);
    for (const status of LEGACY_INVOICE_REGISTRY_STATUSES)
        push(status);
    for (const status of used)
        push(status);
    return out;
}

const STATUS_TONES: Record<string, string> = {
    'Черновик': 'draft',
    'На согласовании с Клиентом': 'review',
    'Отправлен': 'sent',
    'Выставлен': 'issued',
    'Оплата в пути': 'transit',
    'Частично оплачен': 'partial',
    'Оплачен': 'paid',
    'Ольге направить': 'olga',
    'Просрочен': 'overdue',
    'Отменён': 'canceled',
};

export function registryStatusToneClass(value: string): string {
    const label = normalizeRegistryStatusLabel(value);
    if (!label)
        return 'tt-inv-reg-status--empty';
    return `tt-inv-reg-status--${STATUS_TONES[label] ?? 'legacy'}`;
}
