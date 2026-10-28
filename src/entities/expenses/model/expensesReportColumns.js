import { STATUS_META, TYPE_META, PAYMENT_META, REIMBURSABLE_META, getPartnerExpenseSubtypeLabel } from './constants';
import { asExpenseNumber } from './coerceExpense';
import { formatExpenseAuthorExport, formatPartnerUserLabel } from './expenseAuthor';
function fmtDate(iso) {
    if (!iso)
        return '';
    const s = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return iso;
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}
function fmtMoney(n) {
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}
const expenseProjectLabels = new Map();
export function setExpenseReportProjectLabels(rows) {
    expenseProjectLabels.clear();
    for (const row of rows) {
        const id = row.id.trim();
        if (!id)
            continue;
        expenseProjectLabels.set(id, {
            clientName: row.clientName.trim(),
            projectName: row.name.trim(),
        });
    }
}
export function expenseReportClientName(request) {
    const id = request.projectId?.trim();
    if (!id)
        return '';
    return expenseProjectLabels.get(id)?.clientName ?? '';
}
export function expenseReportProjectName(request) {
    const id = request.projectId?.trim();
    if (!id)
        return '';
    return expenseProjectLabels.get(id)?.projectName || id;
}
export const EXPENSE_REPORT_COLUMNS = [
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
        partnerDefaultVisible: false,
        minWidth: 130,
        value: r => TYPE_META[r.expenseType]?.label ?? r.expenseType,
    },
    {
        id: 'expenseSubtype',
        label: 'Категория партнёра',
        defaultVisible: false,
        partnerDefaultVisible: true,
        minWidth: 160,
        value: r => getPartnerExpenseSubtypeLabel(r.expenseSubtype),
    },
    {
        id: 'partnerUser',
        label: 'Партнёр',
        defaultVisible: false,
        partnerDefaultVisible: true,
        minWidth: 180,
        value: r => formatPartnerUserLabel(r),
    },
    {
        id: 'status',
        label: 'Статус',
        defaultVisible: true,
        minWidth: 130,
        value: r => STATUS_META[r.status]?.label ?? r.status,
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
            const pm = r.paymentMethod;
            if (!pm)
                return '';
            return PAYMENT_META[pm]?.label ?? String(pm);
        },
    },
    {
        id: 'client',
        label: 'Клиент',
        defaultVisible: true,
        minWidth: 180,
        value: r => expenseReportClientName(r),
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
        label: 'Проект',
        defaultVisible: true,
        minWidth: 180,
        value: r => expenseReportProjectName(r),
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
];
const COL_MAP = new Map(EXPENSE_REPORT_COLUMNS.map(c => [c.id, c]));
export function getDefaultVisibleColumnIds(scope = 'company') {
    return EXPENSE_REPORT_COLUMNS
        .filter(c => (scope === 'partner' ? (c.partnerDefaultVisible ?? c.defaultVisible) : c.defaultVisible))
        .map(c => c.id);
}
export function normalizeVisibleColumnIds(ids, scope = 'company') {
    if (!Array.isArray(ids))
        return getDefaultVisibleColumnIds(scope);
    const allowed = new Set(EXPENSE_REPORT_COLUMNS.map(c => c.id));
    const out = ids.filter((x) => typeof x === 'string' && allowed.has(x));
    return out.length ? out : getDefaultVisibleColumnIds(scope);
}
export function getColumnDef(id) {
    return COL_MAP.get(id);
}
