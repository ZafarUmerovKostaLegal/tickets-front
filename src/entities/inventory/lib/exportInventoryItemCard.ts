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

export type InventoryItemExportFormat = 'pdf' | 'docx' | 'txt';

export type InventoryItemExportInput = {
    item: InventoryItem;
    categoryName?: string | null;
    assignedLabel?: string | null;
    statusLabel: string;
};

export type InventoryExportField = { label: string; value: string };

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

export function inventoryItemExportStem(item: Pick<InventoryItem, 'inventory_number' | 'name'>): string {
    const raw = `${item.inventory_number}_${item.name}`
        .replace(/[<>:"/\\|?*\p{Cc}]+/gu, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return (raw || 'inventory_item').slice(0, 96);
}

export function buildInventoryItemExportFields(input: InventoryItemExportInput): {
    title: string;
    fields: InventoryExportField[];
    monitorChips: string[];
    monitorVesaNo: boolean;
    notes: string;
} {
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

    const fields: InventoryExportField[] = [
        { label: 'Статус', value: `${statusLabel}${item.is_archived ? ' (в архиве)' : ''}` },
        { label: 'Категория', value: dash(categoryName) },
    ];

    if (score) {
        const how = score.source === 'purchase_date'
            ? 'по дате покупки'
            : 'приблизительно, дата покупки не указана';
        fields.push({
            label: 'Оценка техники',
            value: `${score.score}/${EQUIPMENT_SCORE_MAX} — ${score.tier.summary} (${how})`,
        });
    }
    else {
        fields.push({ label: 'Оценка техники', value: '—' });
    }

    if (ram?.canAddRam)
        fields.push({ label: 'ОЗУ', value: ram.hint });

    fields.push(
        { label: 'Инв. номер', value: item.inventory_number },
        { label: 'Серийный номер', value: dash(item.serial_number) },
        { label: 'Закреплено за', value: dash(assignedLabel) },
    );

    if (item.assigned_at) {
        fields.push({
            label: 'Дата закрепления',
            value: formatDateOnly(item.assigned_at) || dash(item.assigned_at),
        });
    }

    fields.push(
        { label: 'Дата покупки', value: formatDateOnly(item.purchase_date) || '—' },
        { label: 'Гарантия до', value: formatDateOnly(item.warranty_until) || '—' },
        { label: 'Добавлена', value: formatDateOnly(item.created_at) || dash(item.created_at) },
        { label: 'Обновлена', value: formatDateOnly(item.updated_at) || dash(item.updated_at) },
        { label: 'UUID', value: item.uuid },
    );

    return {
        title: item.name,
        fields,
        monitorChips,
        monitorVesaNo: monitorParsed?.specs.vesa === 'no',
        notes: notes.trim(),
    };
}

export function buildInventoryItemExportText(input: InventoryItemExportInput): string {
    const { title, fields, monitorChips, monitorVesaNo, notes } = buildInventoryItemExportFields(input);
    const lines: string[] = [
        'Kosta Legal — карточка техники',
        '='.repeat(40),
        `Название: ${title}`,
    ];
    for (const f of fields)
        lines.push(`${f.label}: ${f.value}`);

    if (monitorChips.length > 0) {
        lines.push('', 'Характеристики монитора', '-'.repeat(28));
        for (const chip of monitorChips)
            lines.push(`• ${chip}`);
        if (monitorVesaNo)
            lines.push('• Без крепления VESA');
    }

    if (notes) {
        lines.push('', 'Описание / Заметки', '-'.repeat(28), notes);
    }

    if (input.item.photo_path) {
        lines.push(
            '',
            'Фото',
            '-'.repeat(28),
            'В TXT фото не встраивается. Выберите PDF или Word, чтобы скачать карточку с изображением.',
            `Путь: ${input.item.photo_path}`,
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

export async function processInventoryPhotoForExport(
    source: Blob,
    maxSide = 1280,
    quality = 0.85,
): Promise<{ blob: Blob; width: number; height: number }> {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
        return { blob: source, width: 0, height: 0 };
    }

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(source);
    }
    catch {
        return { blob: source, width: 0, height: 0 };
    }

    try {
        const w = bitmap.width;
        const h = bitmap.height;
        if (!(w > 0 && h > 0))
            return { blob: source, width: 0, height: 0 };
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return { blob: source, width: w, height: h };
        ctx.drawImage(bitmap, 0, 0, tw, th);
        const jpeg = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
        return { blob: jpeg ?? source, width: tw, height: th };
    }
    finally {
        bitmap.close();
    }
}

export async function loadProcessedPhoto(
    photoPath: string | null | undefined,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
    const path = photoPath?.trim();
    if (!path)
        return null;
    try {
        const raw = await fetchPhotoBlob(path);
        const processed = await processInventoryPhotoForExport(raw);
        const buf = await processed.blob.arrayBuffer();
        return {
            bytes: new Uint8Array(buf),
            width: processed.width || 800,
            height: processed.height || 600,
        };
    }
    catch {
        return null;
    }
}

export async function downloadInventoryItemCard(
    input: InventoryItemExportInput,
    format: InventoryItemExportFormat = 'pdf',
): Promise<void> {
    const stem = inventoryItemExportStem(input.item);
    if (format === 'txt') {
        const text = buildInventoryItemExportText(input);
        downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${stem}.txt`);
        return;
    }
    const files = await import('./exportInventoryItemFiles');
    if (format === 'docx') {
        const blob = await files.buildInventoryItemDocxBlob(input);
        downloadBlob(blob, `${stem}.docx`);
        return;
    }
    const blob = await files.buildInventoryItemPdfBlob(input);
    downloadBlob(blob, `${stem}.pdf`);
}
