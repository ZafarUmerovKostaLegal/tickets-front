import type { ExpenseAmountCurrency, ExpenseStatus, ExpenseType, PartnerExpenseCategory, PaymentMethod, } from './types';

/**
 * Statuses in company/partner registry filters and reports.
 * Matches the live UI workflow (create → approve → pay / reject / revise / withdraw).
 * `closed` / `not_reimbursable` remain in STATUS_META for legacy rows but are not
 * offered as filters after close / «Не оплачено» actions were removed.
 */
export const EXPENSE_REGISTRY_STATUSES: ExpenseStatus[] = [
    'draft',
    'pending_approval',
    'revision_required',
    'approved',
    'paid',
    'rejected',
    'withdrawn',
];
export const EXPENSE_REGISTRY_STATUS_SET = new Set<ExpenseStatus>(EXPENSE_REGISTRY_STATUSES);

/** Create / submit / moderation queue — subset of workflow statuses. */
export const EXPENSE_WORKFLOW_STATUSES: ExpenseStatus[] = [
    'draft',
    'pending_approval',
];

export const STATUS_META: Record<ExpenseStatus, {
    label: string;
}> = {
    draft: { label: 'Черновик' },
    pending_approval: { label: 'На согласовании' },
    revision_required: { label: 'На доработку' },
    approved: { label: 'Одобрено' },
    rejected: { label: 'Отказано' },
    paid: { label: 'Оплачено' },
    closed: { label: 'Закрыто' },
    not_reimbursable: { label: 'Невозмещаемый' },
    withdrawn: { label: 'Отозвана' },
};
export const TYPE_META: Record<ExpenseType, {
    label: string;
}> = {
    transport: { label: 'Транспорт' },
    food: { label: 'Питание' },
    accommodation: { label: 'Проживание' },
    purchase: { label: 'Закупка' },
    services: { label: 'Сервисы' },
    entertainment: { label: 'Представительские' },
    client_expense: { label: 'За клиента' },
    partner_expense: { label: 'Расход партнёра' },
    other: { label: 'Прочее' },
};
export const PAYMENT_META: Record<PaymentMethod, {
    label: string;
}> = {
    cash: { label: 'Наличные/Личная карта' },
    transfer: { label: 'Перечисление' },
    card: { label: 'Корпоративная карта офиса' },
};
export const REIMBURSABLE_META: Record<string, {
    label: string;
}> = {
    reimbursable: { label: 'Возмещаемый клиентом' },
    non_reimbursable: { label: 'Невозмещаемый клиентом' },
};
export const EXPENSE_CURRENCIES: {
    value: ExpenseAmountCurrency;
    label: string;
}[] = [
    { value: 'UZS', label: 'Сум' },
    { value: 'RUB', label: 'Рубли' },
    { value: 'USD', label: 'Доллары' },
    { value: 'GBP', label: 'Фунты' },
    { value: 'EUR', label: 'Евро' },
];
export const PARTNER_EXPENSE_CATEGORY_META: Record<PartnerExpenseCategory, {
    label: string;
}> = {
    partner_fuel: { label: 'Заправка' },
    partner_air: { label: 'авиабилеты' },
    partner_meetings_food: { label: 'встречи (рестораны, еда)' },
    partner_shop: { label: 'покупки (shop)' },
    partner_misc: { label: 'разное' },
};
const LEGACY_PARTNER_EXPENSE_LABELS: Record<string, string> = {
    partner_office: 'Офис и административные расходы',
    partner_travel: 'Командировки и проезд',
    partner_representation: 'Представительские',
    partner_marketing: 'Маркетинг и PR',
    partner_professional: 'Профессиональные услуги',
    partner_equipment: 'IT и оборудование',
    partner_other: 'Прочее',
};
export function getPartnerExpenseSubtypeLabel(subtype: string | null | undefined): string {
    const s = (subtype ?? '').trim();
    if (!s)
        return '';
    if (Object.prototype.hasOwnProperty.call(PARTNER_EXPENSE_CATEGORY_META, s)) {
        return PARTNER_EXPENSE_CATEGORY_META[s as PartnerExpenseCategory].label;
    }
    return LEGACY_PARTNER_EXPENSE_LABELS[s] ?? s;
}
export const PARTNER_EXPENSE_CATEGORIES: {
    value: PartnerExpenseCategory;
    label: string;
}[] = [
    { value: 'partner_fuel', label: PARTNER_EXPENSE_CATEGORY_META.partner_fuel.label },
    { value: 'partner_air', label: PARTNER_EXPENSE_CATEGORY_META.partner_air.label },
    { value: 'partner_meetings_food', label: PARTNER_EXPENSE_CATEGORY_META.partner_meetings_food.label },
    { value: 'partner_shop', label: PARTNER_EXPENSE_CATEGORY_META.partner_shop.label },
    { value: 'partner_misc', label: PARTNER_EXPENSE_CATEGORY_META.partner_misc.label },
];
export const EXPENSE_TYPES: {
    value: ExpenseType;
    label: string;
}[] = [
    { value: 'transport', label: 'Транспорт' },
    { value: 'food', label: 'Питание' },
    { value: 'accommodation', label: 'Проживание' },
    { value: 'purchase', label: 'Закупка' },
    { value: 'services', label: 'Сервисы' },
    { value: 'entertainment', label: 'Представительские' },
    { value: 'client_expense', label: 'За клиента' },
    { value: 'partner_expense', label: 'Расход партнёра' },
    { value: 'other', label: 'Прочее' },
];
/** Types on «Расходы компании» (без partner — партнёрские в отдельном табе). */
export const COMPANY_EXPENSE_TYPES: {
    value: Exclude<ExpenseType, 'partner_expense'>;
    label: string;
}[] = EXPENSE_TYPES.filter(
    (t): t is { value: Exclude<ExpenseType, 'partner_expense'>; label: string } =>
        t.value !== 'partner_expense',
);
export const COMPANY_EXPENSE_TYPE_CODES: Exclude<ExpenseType, 'partner_expense'>[] = COMPANY_EXPENSE_TYPES.map(t => t.value);
export const PAYMENT_METHODS: {
    value: PaymentMethod;
    label: string;
}[] = [
    { value: 'cash', label: PAYMENT_META.cash.label },
    { value: 'transfer', label: PAYMENT_META.transfer.label },
    { value: 'card', label: PAYMENT_META.card.label },
];
