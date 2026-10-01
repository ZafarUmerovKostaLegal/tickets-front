/** Fixed statuses for the registry «Статус» column. */
export const INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'На согласовании с Клиентом',
    'Выставлен',
    'Оплачен',
] as const;

export type InvoiceRegistryStatus = (typeof INVOICE_REGISTRY_STATUSES)[number];

export function isInvoiceRegistryStatus(value: string): value is InvoiceRegistryStatus {
    return (INVOICE_REGISTRY_STATUSES as readonly string[]).includes(value);
}

/** Short free-text statuses already used on the Excel sheets. */
export const LEGACY_INVOICE_REGISTRY_STATUSES = [
    'Ольге направила',
    'Ольге направила.',
    'жду подтверждения от клиента',
    'Аннулирован',
    'Попросил выставить в октябре',
] as const;

/** Fixed list, then the old Excel phrases, then any other text already on the sheet. */
export function collectRegistryStatusOptions(used: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (raw: string) => {
        const value = raw.replace(/\s+/g, ' ').trim();
        if (!value || seen.has(value))
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
    if (value === 'Черновик')
        return 'tt-inv-reg-status--draft';
    if (value === 'На согласовании с Клиентом' || value === 'Частично оплачен' || value === 'Просрочен')
        return 'tt-inv-reg-status--review';
    if (value === 'Выставлен' || value === 'Отправлен' || value === 'Просмотрен')
        return 'tt-inv-reg-status--issued';
    if (value === 'Оплачен')
        return 'tt-inv-reg-status--paid';
    if (value === 'Отменён')
        return 'tt-inv-reg-status--canceled';
    if (value)
        return 'tt-inv-reg-status--legacy';
    return 'tt-inv-reg-status--empty';
}
