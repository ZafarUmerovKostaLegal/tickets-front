/** Fixed statuses for the registry «Статус» column. */
export const INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'На согласовании с Клиентом',
    'Выставлен',
    'Оплачен',
    'Оплачен клиентом',
    'Ольге направить',
] as const;

export type InvoiceRegistryStatus = (typeof INVOICE_REGISTRY_STATUSES)[number];

/** Statuses an accountant can set on a live system invoice from the registry. */
export const SYSTEM_INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'На согласовании с Клиентом',
    'Жду подтверждения от клиента',
    'Отправлен',
    'Выставлен',
    'Просмотрен',
    'Частично оплачен',
    'Оплачен',
    'Оплачен клиентом',
    'Ольге направить',
    'Просрочен',
    'Отменён',
] as const;

export function isInvoiceRegistryStatus(value: string): value is InvoiceRegistryStatus {
    return (INVOICE_REGISTRY_STATUSES as readonly string[]).includes(value);
}

/** Short free-text statuses already used on the Excel sheets. */
export const LEGACY_INVOICE_REGISTRY_STATUSES = [
    'Жду подтверждения от клиента',
    'Аннулирован',
] as const;

const HIDDEN_REGISTRY_STATUSES = new Set([
    'попросил выставить в октябре',
    'просмотрен',
]);

const REGISTRY_STATUS_ALIASES: Record<string, string> = {
    'ольге направила': 'Ольге направить',
    'жду подтверждения от клиента': 'Жду подтверждения от клиента',
};

function registryStatusKey(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim().replace(/\.+$/g, '').toLowerCase();
}

/** One spelling, and a capital first letter for every status label. */
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

/** Fixed list, then the old Excel phrases, then any other text already on the sheet. */
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

/** Tone class for the registry status pill, including live system-invoice labels. */
export function registryStatusToneClass(value: string): string {
    const label = normalizeRegistryStatusLabel(value);
    if (label === 'Черновик')
        return 'tt-inv-reg-status--draft';
    if (label === 'На согласовании с Клиентом' || label === 'Частично оплачен' || label === 'Просрочен')
        return 'tt-inv-reg-status--review';
    if (label === 'Выставлен' || label === 'Отправлен' || label === 'Просмотрен')
        return 'tt-inv-reg-status--issued';
    if (label === 'Оплачен' || label === 'Оплачен клиентом')
        return 'tt-inv-reg-status--paid';
    if (label === 'Отменён')
        return 'tt-inv-reg-status--canceled';
    if (label)
        return 'tt-inv-reg-status--legacy';
    return 'tt-inv-reg-status--empty';
}
