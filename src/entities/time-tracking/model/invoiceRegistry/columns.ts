import type { InvoiceRegistryColumnDef, InvoiceRegistrySheetMeta, InvoiceRegistryYearId } from './types';

const COL_2026: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'billedTo', label: 'Кому выставлено', wide: true },
    { key: 'currency', label: 'Валюта' },
    { key: 'amount', label: 'Выставленная сумма' },
    { key: 'details', label: 'Детали (краткое описание за какую работу этот инвойс)', wide: true },
    { key: 'partner', label: 'Партнёр' },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Предполагаемая дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер инвойса для Клиента' },
    { key: 'statusNote', label: 'Статус', editor: 'status' },
    { key: 'advanceFee', label: 'Пред.вознаграждение', wide: true },
    { key: 'balance', label: 'Остаток' },
];

const COL_2025: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'billedTo', label: 'Кому выставлено', wide: true },
    { key: 'currency', label: 'Валюта' },
    { key: 'amount', label: 'Выставленная сумма' },
    { key: 'details', label: 'Детали', wide: true },
    { key: 'partner', label: 'Партнёр' },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер' },
    { key: 'statusNote', label: 'Статус', editor: 'status' },
    { key: 'advanceFee', label: 'Пред.вознаграждение', wide: true },
    { key: 'balance', label: 'Остаток' },
];

const COL_2024: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'billedTo', label: 'Кому выставлено', wide: true },
    { key: 'currency', label: 'Валюта' },
    { key: 'amount', label: 'Сумма' },
    { key: 'details', label: 'Детали', wide: true },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер' },
    { key: 'statusNote', label: 'Статус', editor: 'status' },
    { key: 'advanceFee', label: 'Пред.вознаграждение', wide: true },
    { key: 'balance', label: 'Остаток' },
];

const COL_2023: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер' },
    { key: 'billedTo', label: 'Клиент', wide: true },
    { key: 'amount', label: 'Сумма' },
    { key: 'currency', label: 'Валюта' },
    { key: 'details', label: 'Детали', wide: true },
    { key: 'statusNote', label: 'Статус', editor: 'status' },
];

const COL_2022: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер' },
    { key: 'billedTo', label: 'Клиент', wide: true },
    { key: 'amount', label: 'Сумма' },
    { key: 'currency', label: 'Валюта' },
    { key: 'details', label: 'Детали', wide: true },
];

const COL_2021: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер' },
    { key: 'billedTo', label: 'Клиент', wide: true },
    { key: 'amount', label: 'Сумма' },
    { key: 'currency', label: 'Валюта' },
    { key: 'details', label: 'Детали', wide: true },
    { key: 'uzbSia', label: 'UZB/SIA' },
];

const COL_2020: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'issueDate', label: 'Дата выставления' },
    { key: 'dueOrPayment', label: 'Дата оплаты', wide: true },
    { key: 'clientNumber', label: 'Номер' },
    { key: 'billedTo', label: 'Клиент', wide: true },
    { key: 'amount', label: 'Сумма' },
    { key: 'currency', label: 'Валюта' },
    { key: 'details', label: 'Детали', wide: true },
    { key: 'uzbSia', label: 'UZB/SIA' },
];

const COL_CHECKLIST: InvoiceRegistryColumnDef[] = [
    { key: 'seqNo', label: '№' },
    { key: 'billedTo', label: 'Client', wide: true },
    { key: 'proposal', label: 'Proposal' },
    { key: 'contractDraft', label: 'Contract Draft' },
    { key: 'contractSigned', label: 'Contract signed' },
    { key: 'addAgreement', label: 'Доп согл', wide: true },
    { key: 'invoice', label: 'Invoice' },
    { key: 'actStamp', label: 'Счет фактура печать/подпись', wide: true },
    { key: 'issued', label: 'Выставлено' },
    { key: 'received', label: 'Получено' },
    { key: 'comments', label: 'КОММЕНТАРИИ', wide: true },
];

export const INVOICE_REGISTRY_SHEETS: InvoiceRegistrySheetMeta[] = [
    { year: '2026', sheetName: 'Инвойс 2026', columns: COL_2026 },
    { year: '2025', sheetName: 'Инвойс 2025', columns: COL_2025 },
    { year: '2024', sheetName: 'Инвойс 2024', columns: COL_2024 },
    { year: '2023', sheetName: 'Инвойс 2023', columns: COL_2023 },
    { year: '2022', sheetName: 'Инвойс 2022', columns: COL_2022 },
    { year: '2021', sheetName: 'Инвойс 2021', columns: COL_2021 },
    { year: '2020', sheetName: 'Инвойс 2020', columns: COL_2020 },
    { year: 'checklist', sheetName: 'check list', columns: COL_CHECKLIST },
];

export function getInvoiceRegistrySheet(year: InvoiceRegistryYearId): InvoiceRegistrySheetMeta {
    const found = INVOICE_REGISTRY_SHEETS.find((s) => s.year === year);
    return found ?? INVOICE_REGISTRY_SHEETS[0]!;
}
