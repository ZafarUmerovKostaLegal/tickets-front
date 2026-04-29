import type { ExpenseRequest, ExpenseStatus, ExpenseType } from './types';
import { STATUS_META, TYPE_META, PAYMENT_META, REIMBURSABLE_META } from './constants';
import { asExpenseNumber } from './coerceExpense';
import { formatExpenseAuthorExport } from './expenseAuthor';
export type ExpenseReportColumnId = 'expenseDate' | 'description' | 'expenseType' | 'status' | 'amountUzs' | 'equivalentUsd' | 'isReimbursable' | 'paymentMethod' | 'vendor' | 'projectId' | 'comment' | 'author' | 'createdAt' | 'paymentDeadline' | 'businessPurpose' | 'id';
export type ExpenseReportColumnDef = {
    id: ExpenseReportColumnId;
    label: string;
    defaultVisible: boolean;
    minWidth?: number;
    value: (r: ExpenseRequest) => string;
};
function fmtDate(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const s = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return iso;
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}
function fmtMoney(n: number): string {
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}
export const EXPENSE_REPORT_COLUMNS: ExpenseReportColumnDef[] = [
    {
        id: 'id',
        label: 'ID заявки',
        defaultVisible: false,
        minWidth: 280,
        value: r => r.id,
    },
    {
        id: 'expenseDate',
        label: 'Дата расхода',
        defaultVisible: true,
        minWidth: 110,
        value: r => fmtDate(r.expenseDate),
    },
    {
        id: 'description',
        label: 'Описание',
        defaultVisible: true,
        minWidth: 200,
        value: r => r.description ?? '',
    },
    {
        id: 'expenseType',
        label: 'Тип',
        defaultVisible: true,
        minWidth: 130,
        value: r => TYPE_META[r.expenseType as ExpenseType]?.label ?? r.expenseType,
    },
    {
        id: 'status',
        label: 'Статус',
        defaultVisible: true,
        minWidth: 130,
        value: r => STATUS_META[r.status as ExpenseStatus]?.label ?? r.status,
    },
    {
        id: 'amountUzs',
        label: 'Сумма, UZS',
        defaultVisible: true,
        minWidth: 120,
        value: r => fmtMoney(asExpenseNumber(r.amountUzs)),
    },
    {
        id: 'equivalentUsd',
        label: 'Эквивалент, USD',
        defaultVisible: true,
        minWidth: 120,
        value: r => asExpenseNumber(r.equivalentAmount).toFixed(2),
    },
    {
        id: 'isReimbursable',
        label: 'Возмещение',
        defaultVisible: true,
        minWidth: 120,
        value: r => (r.isReimbursable ? REIMBURSABLE_META.reimbursable.label : REIMBURSABLE_META.non_reimbursable.label),
    },
    {
        id: 'paymentMethod',
        label: 'Способ оплаты',
        defaultVisible: false,
        minWidth: 140,
        value: r => {
            const pm = r.paymentMethod as keyof typeof PAYMENT_META | null;
            if (!pm)
                return '';
            return PAYMENT_META[pm]?.label ?? String(pm);
        },
    },
    {
        id: 'vendor',
        label: 'Контрагент / поставщик',
        defaultVisible: true,
        minWidth: 160,
        value: r => r.vendor ?? '',
    },
    {
        id: 'projectId',
        label: 'Проект (ID)',
        defaultVisible: false,
        minWidth: 280,
        value: r => r.projectId ?? '',
    },
    {
        id: 'comment',
        label: 'Комментарий',
        defaultVisible: false,
        minWidth: 180,
        value: r => r.comment ?? '',
    },
    {
        id: 'businessPurpose',
        label: 'Цель',
        defaultVisible: false,
        minWidth: 160,
        value: r => r.businessPurpose ?? '',
    },
    {
        id: 'author',
        label: 'Автор',
        defaultVisible: true,
        minWidth: 180,
        value: r => formatExpenseAuthorExport(r),
    },
    {
        id: 'createdAt',
        label: 'Создано',
        defaultVisible: false,
        minWidth: 110,
        value: r => fmtDate(r.createdAt?.slice(0, 10)),
    },
    {
        id: 'paymentDeadline',
        label: 'Срок оплаты',
        defaultVisible: false,
        minWidth: 110,
        value: r => fmtDate(r.paymentDeadline),
    },
];
const COL_MAP = new Map(EXPENSE_REPORT_COLUMNS.map(c => [c.id, c]));
export function getDefaultVisibleColumnIds(): ExpenseReportColumnId[] {
    return EXPENSE_REPORT_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);
}
export function normalizeVisibleColumnIds(ids: unknown): ExpenseReportColumnId[] {
    if (!Array.isArray(ids))
        return getDefaultVisibleColumnIds();
    const allowed = new Set(EXPENSE_REPORT_COLUMNS.map(c => c.id));
    const out = ids.filter((x): x is ExpenseReportColumnId => typeof x === 'string' && allowed.has(x as ExpenseReportColumnId));
    return out.length ? out : getDefaultVisibleColumnIds();
}
export function getColumnDef(id: ExpenseReportColumnId): ExpenseReportColumnDef | undefined {
    return COL_MAP.get(id);
}
