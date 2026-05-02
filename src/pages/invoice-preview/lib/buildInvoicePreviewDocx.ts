import { Document, Packer, Paragraph } from 'docx';

/** Три пустые страницы A4 в виде трёх разделов (заготовка печатной формы счёта). */
export async function buildBlankInvoicePreviewDocxBlob(): Promise<Blob> {
    const doc = new Document({
        sections: [
            { properties: {}, children: [new Paragraph('')] },
            { properties: {}, children: [new Paragraph('')] },
            { properties: {}, children: [new Paragraph('')] },
        ],
    });
    return Packer.toBlob(doc);
}
