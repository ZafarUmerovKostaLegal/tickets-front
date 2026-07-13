import { PDFDocument, degrees } from 'pdf-lib';

const MAX_BYTES = 15 * 1024 * 1024;

export class CorrespondencePdfEditorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CorrespondencePdfEditorError';
    }
}

export function assertPdfFile(file: File): void {
    if (file.size <= 0)
        throw new CorrespondencePdfEditorError('Файл пустой');
    if (file.size > MAX_BYTES)
        throw new CorrespondencePdfEditorError('Файл больше 15 МБ');
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (type !== 'application/pdf' && !name.endsWith('.pdf'))
        throw new CorrespondencePdfEditorError('Нужен файл PDF');
}

export async function loadPdfFromFile(file: File): Promise<PDFDocument> {
    assertPdfFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
        return await PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    catch {
        throw new CorrespondencePdfEditorError('Не удалось прочитать PDF');
    }
}

export async function mergePdfInto(target: PDFDocument, file: File): Promise<void> {
    const incoming = await loadPdfFromFile(file);
    const count = incoming.getPageCount();
    if (count === 0)
        throw new CorrespondencePdfEditorError('PDF без страниц');
    const copied = await target.copyPages(incoming, [...Array(count).keys()]);
    copied.forEach((p) => target.addPage(p));
}

export async function buildSinglePageBlob(doc: PDFDocument, pageIndex: number): Promise<Blob> {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [pageIndex]);
    single.addPage(page);
    const bytes = await single.save();
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export async function savePdfBlob(doc: PDFDocument): Promise<Blob> {
    const bytes = await savePdfBytes(doc);
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export async function savePdfBytes(doc: PDFDocument): Promise<Uint8Array> {
    if (doc.getPageCount() === 0)
        throw new CorrespondencePdfEditorError('Документ без страниц');
    return doc.save();
}

export function rotatePage(doc: PDFDocument, pageIndex: number, delta: 90 | -90): void {
    const page = doc.getPage(pageIndex);
    const current = page.getRotation().angle;
    page.setRotation(degrees(current + delta));
}

export function removePage(doc: PDFDocument, pageIndex: number): void {
    if (doc.getPageCount() <= 1)
        throw new CorrespondencePdfEditorError('Нельзя удалить единственную страницу');
    doc.removePage(pageIndex);
}

export function movePage(doc: PDFDocument, from: number, to: number): void {
    if (from === to)
        return;
    const count = doc.getPageCount();
    if (from < 0 || from >= count || to < 0 || to >= count)
        return;
    const order = [...Array(count).keys()];
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    reorderPages(doc, order);
}


export async function reorderPages(doc: PDFDocument, order: number[]): Promise<PDFDocument> {
    const next = await PDFDocument.create();
    const copied = await next.copyPages(doc, order);
    copied.forEach((p) => next.addPage(p));
    return next;
}

export function defaultDownloadName(sourceName?: string): string {
    const base = (sourceName ?? 'document').replace(/\.pdf$/i, '').trim() || 'document';
    return `${base}-edited.pdf`;
}

export function triggerPdfDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
