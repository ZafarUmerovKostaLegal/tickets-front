import fontkit from '@pdf-lib/fontkit';
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun, } from 'docx';
import { PDFDocument, rgb } from 'pdf-lib';
import dejavuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import dejavuSansRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import { EQUIPMENT_SCORE_MAX, resolveEquipmentScore, } from '../model/equipmentScore';
import { laptopRamUpgrade } from '../model/laptopRamUpgrade';
import { hasMonitorSpecs, isMonitorCategory, monitorSpecsSummary, parseMonitorDescription, } from '../model/monitorSpecs';
import { apiFetch } from '@shared/api';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { formatDateOnly } from '@shared/lib/formatDate';
function dash(v) {
    const t = (v ?? '').trim();
    return t || '—';
}
function encodeMediaPath(mediaPath) {
    const path = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
    return path
        .split('/')
        .filter((s) => s.length > 0 && s !== '.' && s !== '..')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
}
/** Safe download stem from inv. number + name. */
export function inventoryItemExportStem(item) {
    const raw = `${item.inventory_number}_${item.name}`
        .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return (raw || 'inventory_item').slice(0, 96);
}
/** Structured rows shared by PDF / Word / TXT. */
export function buildInventoryItemExportFields(input) {
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
    const fields = [
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
    fields.push({ label: 'Инв. номер', value: item.inventory_number }, { label: 'Серийный номер', value: dash(item.serial_number) }, { label: 'Закреплено за', value: dash(assignedLabel) });
    if (item.assigned_at) {
        fields.push({
            label: 'Дата закрепления',
            value: formatDateOnly(item.assigned_at) || dash(item.assigned_at),
        });
    }
    fields.push({ label: 'Дата покупки', value: formatDateOnly(item.purchase_date) || '—' }, { label: 'Гарантия до', value: formatDateOnly(item.warranty_until) || '—' }, { label: 'Добавлена', value: formatDateOnly(item.created_at) || dash(item.created_at) }, { label: 'Обновлена', value: formatDateOnly(item.updated_at) || dash(item.updated_at) }, { label: 'UUID', value: item.uuid });
    return {
        title: item.name,
        fields,
        monitorChips,
        monitorVesaNo: monitorParsed?.specs.vesa === 'no',
        notes: notes.trim(),
    };
}
/** Human-readable card for a .txt export (photo is not embedded). */
export function buildInventoryItemExportText(input) {
    const { title, fields, monitorChips, monitorVesaNo, notes } = buildInventoryItemExportFields(input);
    const lines = [
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
        lines.push('', 'Фото', '-'.repeat(28), 'В TXT фото не встраивается. Выберите PDF или Word, чтобы скачать карточку с изображением.', `Путь: ${input.item.photo_path}`);
    }
    lines.push('', `Сформировано: ${new Date().toLocaleString('ru-RU')}`);
    return `${lines.join('\n')}\n`;
}
async function fetchPhotoBlob(photoPath) {
    const safePath = encodeMediaPath(photoPath);
    const res = await apiFetch(`/api/v1/media/${safePath}`);
    if (!res.ok)
        throw new Error(`Не удалось загрузить фото (${res.status})`);
    return res.blob();
}
/** Downscale + JPEG compress for a compact export photo. */
export async function processInventoryPhotoForExport(source, maxSide = 1280, quality = 0.85) {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
        return { blob: source, width: 0, height: 0 };
    }
    let bitmap;
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
        const jpeg = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
        return { blob: jpeg ?? source, width: tw, height: th };
    }
    finally {
        bitmap.close();
    }
}
async function loadProcessedPhoto(photoPath) {
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
async function fetchFontBytes(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`Не удалось загрузить шрифт PDF (${res.status})`);
    return res.arrayBuffer();
}
function wrapPdfText(text, font, size, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return [''];
    const lines = [];
    let cur = words[0];
    for (let i = 1; i < words.length; i += 1) {
        const next = `${cur} ${words[i]}`;
        if (font.widthOfTextAtSize(next, size) <= maxWidth)
            cur = next;
        else {
            lines.push(cur);
            cur = words[i];
        }
    }
    lines.push(cur);
    return lines;
}
export async function buildInventoryItemPdfBlob(input) {
    const card = buildInventoryItemExportFields(input);
    const photo = await loadProcessedPhoto(input.item.photo_path);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
        fetchFontBytes(dejavuSansRegularUrl),
        fetchFontBytes(dejavuSansBoldUrl),
    ]);
    const font = await doc.embedFont(regularBytes, { subset: true });
    const fontBold = await doc.embedFont(boldBytes, { subset: true });
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const ML = 48;
    const MR = 48;
    const MT = 48;
    const MB = 48;
    const contentW = PAGE_W - ML - MR;
    const ink = rgb(0.12, 0.14, 0.18);
    const muted = rgb(0.4, 0.45, 0.52);
    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MT;
    const ensureSpace = (need) => {
        if (y - need >= MB)
            return;
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MT;
    };
    const drawLine = (text, size, bold = false, color = ink) => {
        const f = bold ? fontBold : font;
        const lines = wrapPdfText(text, f, size, contentW);
        for (const line of lines) {
            ensureSpace(size + 4);
            page.drawText(line, { x: ML, y: y - size, size, font: f, color });
            y -= size + 4;
        }
    };
    drawLine('Kosta Legal — карточка техники', 11, false, muted);
    y -= 6;
    drawLine(card.title, 18, true);
    y -= 10;
    if (photo) {
        try {
            const img = await doc.embedJpg(photo.bytes);
            const maxW = contentW;
            const maxH = 220;
            const scale = Math.min(maxW / photo.width, maxH / photo.height, 1);
            const iw = Math.max(1, photo.width * scale);
            const ih = Math.max(1, photo.height * scale);
            ensureSpace(ih + 16);
            page.drawImage(img, { x: ML, y: y - ih, width: iw, height: ih });
            y -= ih + 14;
        }
        catch {
            /* skip broken photo */
        }
    }
    for (const f of card.fields) {
        ensureSpace(28);
        page.drawText(f.label.toUpperCase(), {
            x: ML,
            y: y - 9,
            size: 8,
            font: fontBold,
            color: muted,
        });
        y -= 12;
        drawLine(f.value, 11, false);
        y -= 6;
    }
    if (card.monitorChips.length > 0) {
        y -= 4;
        drawLine('Характеристики монитора', 12, true);
        y -= 4;
        drawLine(card.monitorChips.join(' · '), 11);
        if (card.monitorVesaNo)
            drawLine('Без крепления VESA', 10, false, muted);
        y -= 4;
    }
    if (card.notes) {
        y -= 4;
        drawLine('Описание / Заметки', 12, true);
        y -= 2;
        drawLine(card.notes, 11);
    }
    y -= 10;
    drawLine(`Сформировано: ${new Date().toLocaleString('ru-RU')}`, 9, false, muted);
    const bytes = await doc.save();
    return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' });
}
export async function buildInventoryItemDocxBlob(input) {
    const card = buildInventoryItemExportFields(input);
    const photo = await loadProcessedPhoto(input.item.photo_path);
    const children = [
        new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({
                    text: 'Kosta Legal — карточка техники',
                    font: 'Calibri',
                    size: 20,
                    color: '64748B',
                })],
        }),
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
            children: [new TextRun({ text: card.title, font: 'Calibri', bold: true, size: 32 })],
        }),
    ];
    if (photo) {
        const maxW = 480;
        const scale = Math.min(1, maxW / Math.max(photo.width, 1));
        const w = Math.max(1, Math.round(photo.width * scale));
        const h = Math.max(1, Math.round(photo.height * scale));
        children.push(new Paragraph({
            spacing: { after: 200 },
            children: [new ImageRun({
                    type: 'jpg',
                    data: photo.bytes,
                    transformation: { width: w, height: h },
                })],
        }));
    }
    for (const f of card.fields) {
        children.push(new Paragraph({
            spacing: { before: 80, after: 0 },
            children: [new TextRun({
                    text: f.label.toUpperCase(),
                    font: 'Calibri',
                    size: 16,
                    bold: true,
                    color: '64748B',
                })],
        }));
        children.push(new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: f.value, font: 'Calibri', size: 22 })],
        }));
    }
    if (card.monitorChips.length > 0) {
        children.push(new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [new TextRun({
                    text: 'Характеристики монитора',
                    font: 'Calibri',
                    size: 24,
                    bold: true,
                })],
        }));
        children.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({
                    text: card.monitorChips.join(' · '),
                    font: 'Calibri',
                    size: 22,
                })],
        }));
        if (card.monitorVesaNo) {
            children.push(new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({
                        text: 'Без крепления VESA',
                        font: 'Calibri',
                        size: 20,
                        color: '64748B',
                    })],
            }));
        }
    }
    if (card.notes) {
        children.push(new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [new TextRun({
                    text: 'Описание / Заметки',
                    font: 'Calibri',
                    size: 24,
                    bold: true,
                })],
        }));
        children.push(new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: card.notes, font: 'Calibri', size: 22 })],
        }));
    }
    children.push(new Paragraph({
        spacing: { before: 200 },
        alignment: AlignmentType.LEFT,
        children: [new TextRun({
                text: `Сформировано: ${new Date().toLocaleString('ru-RU')}`,
                font: 'Calibri',
                size: 18,
                color: '64748B',
            })],
    }));
    const doc = new Document({
        sections: [{ children }],
    });
    return Packer.toBlob(doc);
}
/**
 * Download inventory item card as PDF (with photo), Word (with photo), or TXT.
 */
export async function downloadInventoryItemCard(input, format = 'pdf') {
    const stem = inventoryItemExportStem(input.item);
    if (format === 'txt') {
        const text = buildInventoryItemExportText(input);
        downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${stem}.txt`);
        return;
    }
    if (format === 'docx') {
        const blob = await buildInventoryItemDocxBlob(input);
        downloadBlob(blob, `${stem}.docx`);
        return;
    }
    const blob = await buildInventoryItemPdfBlob(input);
    downloadBlob(blob, `${stem}.pdf`);
}
