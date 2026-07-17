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
