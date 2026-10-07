/** Fixed statuses for the registry «Статус» column. */
export const INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'На согласовании с Клиентом',
    'Выставлен',
    'Оплачен',
];
/** Statuses an accountant can set on a live system invoice from the registry. */
export const SYSTEM_INVOICE_REGISTRY_STATUSES = [
    'Черновик',
    'Отправлен',
    'Отменён',
];
export function isInvoiceRegistryStatus(value) {
    return INVOICE_REGISTRY_STATUSES.includes(value);
}
/** Short free-text statuses already used on the Excel sheets. */
export const LEGACY_INVOICE_REGISTRY_STATUSES = [
    'жду подтверждения от клиента',
    'Аннулирован',
];
const HIDDEN_REGISTRY_STATUSES = new Set([
    'ольге направила',
    'попросил выставить в октябре',
    'просмотрен',
]);
function registryStatusKey(raw) {
    return raw.replace(/\s+/g, ' ').trim().replace(/\.+$/g, '').toLowerCase();
}
/** Fixed list, then the old Excel phrases, then any other text already on the sheet. */
export function collectRegistryStatusOptions(used) {
    const seen = new Set();
    const out = [];
    const push = (raw) => {
        const value = raw.replace(/\s+/g, ' ').trim();
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
export function registryStatusToneClass(value) {
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
