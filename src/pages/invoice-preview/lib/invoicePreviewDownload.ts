/** Общие утилиты скачивания предпросмотра счёта (Word/PDF). */

export function sanitizeInvoiceExportFilePart(raw: string): string {
    const t = raw.replace(/[/\\?*:|"<>]/g, '_').replace(/\s+/g, '_').trim();
    return t.slice(0, 72) || 'schet';
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export type InvoiceExportBasenameInput = {
    invoiceNumber?: string | null;
    clientLabel?: string | null;
    issueDateIso?: string | null;
};

/** Имя файла без расширения для экспорта предпросмотра. */
export function buildInvoicePreviewExportBasename(input: InvoiceExportBasenameInput): string {
    const num = input.invoiceNumber?.trim();
    if (num)
        return sanitizeInvoiceExportFilePart(num);
    const base = input.clientLabel?.trim()
        ? `Schet_${sanitizeInvoiceExportFilePart(input.clientLabel.trim())}`
        : 'Schet_predprosmotr';
    const d = input.issueDateIso?.slice(0, 10);
    return d ? `${base}_${d.replace(/-/g, '')}` : base;
}
