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
import { apiFetch } from '@shared/api';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { formatDateOnly } from '@shared/lib/formatDate';

export type InventoryItemExportInput = {
    item: InventoryItem;
    categoryName?: string | null;
    assignedLabel?: string | null;
    statusLabel: string;
};

function dash(v: string | null | undefined): string {
    const t = (v ?? '').trim();
    return t || '—';
}

function encodeMediaPath(mediaPath: string): string {
    const path = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
    return path
        .split('/')
        .filter((s) => s.length > 0 && s !== '.' && s !== '..')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
}

/** Safe download stem from inv. number + name. */
export function inventoryItemExportStem(item: Pick<InventoryItem, 'inventory_number' | 'name'>): string {
    const raw = `${item.inventory_number}_${item.name}`
        .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return (raw || 'inventory_item').slice(0, 96);
}

/** Human-readable card for a .txt export. */
export function buildInventoryItemExportText(input: InventoryItemExportInput): string {
    const { item, categoryName, assignedLabel, statusLabel } = input;
    const score = resolveEquipmentScore(item);
    const ram = laptopRamUpgrade({ ...item, categoryName });
    const monitorParsed = isMonitorCategory(categoryName)
        ? parseMonitorDescription(item.description)
        : null;
    const monitorChips = monitorParsed && hasMonitorSpecs(monitorParsed.specs)
        ? monitorSpecsSummary(monitorParsed.specs)
        : [];
    const notes = monitorParsed
        ? (monitorParsed.notes || '')
        : (item.description?.trim() || '');

    const lines: string[] = [
        'Kosta Legal — карточка техники',
        '='.repeat(40),
        `Название: ${item.name}`,
        `Статус: ${statusLabel}${item.is_archived ? ' (в архиве)' : ''}`,
        `Категория: ${dash(categoryName)}`,
    ];

    if (score) {
        const how = score.source === 'purchase_date'
            ? 'по дате покупки'
            : 'приблизительно, дата покупки не указана';
        lines.push(
            `Оценка техники: ${score.score}/${EQUIPMENT_SCORE_MAX} — ${score.tier.summary} (${how})`,
        );
    }
    else {
        lines.push('Оценка техники: —');
    }

    if (ram?.canAddRam)
        lines.push(`ОЗУ: ${ram.hint}`);

    lines.push(
        `Инв. номер: ${item.inventory_number}`,
        `Серийный номер: ${dash(item.serial_number)}`,
        `Закреплено за: ${dash(assignedLabel)}`,
    );

    if (item.assigned_at)
        lines.push(`Дата закрепления: ${formatDateOnly(item.assigned_at) || dash(item.assigned_at)}`);

    lines.push(
        `Дата покупки: ${formatDateOnly(item.purchase_date) || '—'}`,
        `Гарантия до: ${formatDateOnly(item.warranty_until) || '—'}`,
        `Добавлена: ${formatDateOnly(item.created_at) || dash(item.created_at)}`,
        `Обновлена: ${formatDateOnly(item.updated_at) || dash(item.updated_at)}`,
        `UUID: ${item.uuid}`,
    );

    if (monitorChips.length > 0) {
        lines.push('', 'Характеристики монитора', '-'.repeat(28));
        for (const chip of monitorChips)
            lines.push(`• ${chip}`);
        if (monitorParsed?.specs.vesa === 'no')
            lines.push('• Без крепления VESA');
    }

    if (notes.trim()) {
        lines.push('', 'Описание / Заметки', '-'.repeat(28), notes.trim());
    }

    if (item.photo_path) {
        lines.push(
            '',
            'Фото',
            '-'.repeat(28),
            `Исходный путь: ${item.photo_path}`,
            `Экспорт: ${inventoryItemExportStem(item)}.jpg (JPEG, уменьшено для карточки)`,
        );
    }

    lines.push('', `Сформировано: ${new Date().toLocaleString('ru-RU')}`);
    return `${lines.join('\n')}\n`;
}

async function fetchPhotoBlob(photoPath: string): Promise<Blob> {
    const safePath = encodeMediaPath(photoPath);
    const res = await apiFetch(`/api/v1/media/${safePath}`);
    if (!res.ok)
        throw new Error(`Не удалось загрузить фото (${res.status})`);
    return res.blob();
}

/** Downscale + JPEG compress for a compact export photo. */
export async function processInventoryPhotoForExport(
    source: Blob,
    maxSide = 1280,
    quality = 0.85,
): Promise<Blob> {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined')
        return source;

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(source);
    }
    catch {
        return source;
    }

    try {
        const w = bitmap.width;
        const h = bitmap.height;
        if (!(w > 0 && h > 0))
            return source;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return source;
        ctx.drawImage(bitmap, 0, 0, tw, th);
        const jpeg = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
        return jpeg ?? source;
    }
    finally {
        bitmap.close();
    }
}

/**
 * Download a UTF-8 .txt card and, when present, a processed JPEG of the item photo.
 */
export async function downloadInventoryItemCard(input: InventoryItemExportInput): Promise<void> {
    const stem = inventoryItemExportStem(input.item);
    const text = buildInventoryItemExportText(input);
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${stem}.txt`);

    const photoPath = input.item.photo_path?.trim();
    if (!photoPath)
        return;

    const raw = await fetchPhotoBlob(photoPath);
    const processed = await processInventoryPhotoForExport(raw);
    // Second download after a tick — some browsers drop concurrent downloads.
    await new Promise((r) => window.setTimeout(r, 200));
    downloadBlob(processed, `${stem}.jpg`);
}
