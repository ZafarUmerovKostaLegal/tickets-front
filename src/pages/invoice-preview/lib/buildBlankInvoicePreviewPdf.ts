import { PDFDocument } from 'pdf-lib';

/** ISO 216 A4 в пунктах PDF (72 dpi): 210 мм × 297 мм */
const A4_PT_WIDTH = 595.28;
const A4_PT_HEIGHT = 841.89;

/** Три пустые страницы A4. */
export async function buildBlankInvoicePreviewPdfBlob(): Promise<Blob> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++)
        doc.addPage([A4_PT_WIDTH, A4_PT_HEIGHT]);
    const bytes = await doc.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
}
