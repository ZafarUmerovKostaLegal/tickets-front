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
