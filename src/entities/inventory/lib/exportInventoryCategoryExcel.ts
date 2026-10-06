import type { Alignment, BorderStyle, Borders, Color, Fill, Font } from 'exceljs';
import { getItems } from '../api';
import type { InventoryItem } from '../model/types';
import {
    EQUIPMENT_SCORE_MAX,
    resolveEquipmentScore,
} from '../model/equipmentScore';
import { laptopRamUpgrade } from '../model/laptopRamUpgrade';
import {
    hasMonitorSpecs,
    isMonitorCategory,
    monitorSpecsSummary,
    parseMonitorDescription,
} from '../model/monitorSpecs';
import { loadExcelJS, writeExcelWorkbookBuffer, excelWorkbookBufferToBlob } from '@shared/lib/exceljsLoader';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { formatDateOnly } from '@shared/lib/formatDate';

export type InventoryCategoryExcelInput = {
    categoryId: number;
    categoryName: string;
    /** Status filter from UI; empty = all. */
    status?: string;
    includeArchived?: boolean;
    assignedToUserId?: number | null;
    statusLabel: (value: string) => string;
    userLabel: (userId: number | null) => string;
};

type AC = { argb: string };
const C_HEADER: AC = { argb: 'FF1E293B' };
const C_WHITE: AC = { argb: 'FFFFFFFF' };
const C_ROW_EVEN: AC = { argb: 'FFF8FAFC' };
const C_BORDER: AC = { argb: 'FFE2E8F0' };
const C_MUTED: AC = { argb: 'FF64748B' };

function solid(color: AC): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: color as Color };
}

function border(color: AC = C_BORDER): Partial<Borders> {
    const s: BorderStyle = 'thin';
    const c = color as Color;
    return {
        top: { style: s, color: c },
        bottom: { style: s, color: c },
        left: { style: s, color: c },
        right: { style: s, color: c },
    };
}

function font(opts: Omit<Partial<Font>, 'wrapText'> & { color?: AC } = {}): Partial<Font> {
    const { color, ...rest } = opts;
    return { name: 'Calibri', size: 10, ...(color ? { color: color as Color } : {}), ...rest };
}

function safeFilePart(name: string): string {
    return name
        .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 64) || 'category';
}

const PAGE_SIZE = 200;

/** Load all inventory items for a category (paginated API). */
export async function fetchInventoryItemsForCategoryExport(
    input: Pick<InventoryCategoryExcelInput, 'categoryId' | 'status' | 'includeArchived' | 'assignedToUserId'>,
    signal?: AbortSignal,
): Promise<InventoryItem[]> {
    const out: InventoryItem[] = [];
    let skip = 0;
    for (;;) {
        const page = await getItems({
            skip,
            limit: PAGE_SIZE,
            category_id: input.categoryId,
            status: input.status || undefined,
            assigned_to_user_id: input.assignedToUserId ?? undefined,
            include_archived: input.includeArchived ?? false,
        }, signal);
        out.push(...page.items);
        if (page.items.length === 0 || out.length >= page.total || page.items.length < PAGE_SIZE)
            break;
        skip += PAGE_SIZE;
        if (skip > 50_000)
            break;
    }
    return out;
}

function itemNotesAndSpecs(item: InventoryItem, categoryName: string): { specs: string; notes: string } {
    if (isMonitorCategory(categoryName)) {
        const parsed = parseMonitorDescription(item.description);
        const chips = hasMonitorSpecs(parsed.specs) ? monitorSpecsSummary(parsed.specs) : [];
        if (parsed.specs.vesa === 'no')
            chips.push('без VESA');
        return { specs: chips.join(', '), notes: parsed.notes.trim() };
    }
    return { specs: '', notes: item.description?.trim() || '' };
}

export function buildInventoryCategoryExcelRows(
    items: InventoryItem[],
    input: Pick<InventoryCategoryExcelInput, 'categoryName' | 'statusLabel' | 'userLabel'>,
): Record<string, string | number>[] {
    return items.map((item) => {
        const score = resolveEquipmentScore(item);
        const ram = laptopRamUpgrade({ ...item, categoryName: input.categoryName });
        const { specs, notes } = itemNotesAndSpecs(item, input.categoryName);
        return {
            name: item.name,
            inventory_number: item.inventory_number,
            serial_number: item.serial_number?.trim() || '',
            status: input.statusLabel(item.status),
            score: score ? `${score.score}/${EQUIPMENT_SCORE_MAX}` : '',
            score_note: score
                ? `${score.tier.summary}${score.source === 'class' ? ' (приблизительно)' : ''}`
                : '',
            assigned: input.userLabel(item.assigned_to_user_id),
            assigned_at: formatDateOnly(item.assigned_at) || '',
            purchase_date: formatDateOnly(item.purchase_date) || '',
            warranty_until: formatDateOnly(item.warranty_until) || '',
            specs,
            notes,
            ram: ram?.canAddRam ? ram.hint : '',
            archived: item.is_archived ? 'да' : 'нет',
            created_at: formatDateOnly(item.created_at) || '',
            updated_at: formatDateOnly(item.updated_at) || '',
            uuid: item.uuid,
        };
    });
}

const COLUMNS: { key: string; header: string; width: number }[] = [
    { key: 'name', header: 'Название', width: 28 },
    { key: 'inventory_number', header: 'Инв. номер', width: 14 },
    { key: 'serial_number', header: 'Серийный номер', width: 18 },
    { key: 'status', header: 'Статус', width: 14 },
    { key: 'score', header: 'Оценка', width: 10 },
    { key: 'score_note', header: 'Оценка (пояснение)', width: 28 },
    { key: 'assigned', header: 'Закреплено за', width: 22 },
    { key: 'assigned_at', header: 'Дата закрепления', width: 14 },
    { key: 'purchase_date', header: 'Дата покупки', width: 14 },
    { key: 'warranty_until', header: 'Гарантия до', width: 14 },
    { key: 'specs', header: 'Характеристики', width: 32 },
    { key: 'notes', header: 'Описание / Заметки', width: 36 },
    { key: 'ram', header: 'ОЗУ', width: 28 },
    { key: 'archived', header: 'Архив', width: 8 },
    { key: 'created_at', header: 'Добавлена', width: 12 },
    { key: 'updated_at', header: 'Обновлена', width: 12 },
    { key: 'uuid', header: 'UUID', width: 36 },
];

/** Build and download .xlsx for one inventory category. */
export async function exportInventoryCategoryToExcel(
    input: InventoryCategoryExcelInput,
    signal?: AbortSignal,
): Promise<{ count: number }> {
    const items = await fetchInventoryItemsForCategoryExport(input, signal);
    const rows = buildInventoryCategoryExcelRows(items, input);

    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    const ws = wb.addWorksheet(input.categoryName.slice(0, 31) || 'Техника', {
        views: [{ state: 'frozen', ySplit: 2 }],
    });

    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const title = ws.getCell(1, 1);
    title.value = `Инвентаризация — ${input.categoryName} (${rows.length})`;
    title.font = font({ bold: true, size: 13, color: C_HEADER });
    title.alignment = { vertical: 'middle' } as Partial<Alignment>;
    ws.getRow(1).height = 22;

    const headerRow = ws.getRow(2);
    COLUMNS.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = font({ bold: true, color: C_WHITE, size: 9 });
        cell.fill = solid(C_HEADER);
        cell.border = border();
        cell.alignment = { vertical: 'middle', wrapText: true } as Partial<Alignment>;
        ws.getColumn(i + 1).width = col.width;
    });
    headerRow.height = 20;

    rows.forEach((row, idx) => {
        const excelRow = ws.getRow(idx + 3);
        COLUMNS.forEach((col, i) => {
            const cell = excelRow.getCell(i + 1);
            cell.value = row[col.key] ?? '';
            cell.font = font({ size: 9 });
            cell.border = border();
            cell.fill = solid(idx % 2 === 0 ? C_WHITE : C_ROW_EVEN);
            cell.alignment = { vertical: 'top', wrapText: true } as Partial<Alignment>;
        });
    });

    const footer = ws.getRow(rows.length + 3);
    footer.getCell(1).value = `Сформировано: ${new Date().toLocaleString('ru-RU')}`;
    footer.getCell(1).font = font({ size: 8, color: C_MUTED, italic: true });

    const buffer = await writeExcelWorkbookBuffer(wb);
    const blob = excelWorkbookBufferToBlob(buffer);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `inventory_${safeFilePart(input.categoryName)}_${date}.xlsx`);
    return { count: rows.length };
}
