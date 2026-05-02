import { getInvoice, getTimeManagerClient } from '@entities/time-tracking';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { buildInvoiceCoverLetterModel, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

function fallbackInput() {
    const iso = new Date().toISOString().slice(0, 10);
    return {
        issueDateIso: iso,
        clientName: 'Company Name',
        clientAddress: null as string | null,
        contactName: null as string | null,
        totalAmount: null as number | null,
        currency: 'EUR',
    };
}

/** Загружает клиента/счёт по сессии предпросмотра и собирает модель первой страницы. */
export async function resolveInvoiceCoverLetterModel(session: InvoicePreviewSessionV1 | null): Promise<InvoiceCoverLetterModel> {
    if (!session)
        return buildInvoiceCoverLetterModel(fallbackInput());
    try {
        if (session.mode === 'existing') {
            const inv = await getInvoice(session.invoiceId, true);
            const client = await getTimeManagerClient(inv.clientId);
            return buildInvoiceCoverLetterModel({
                issueDateIso: inv.issueDate.slice(0, 10),
                clientName: client.name,
                clientAddress: client.address,
                contactName: client.contact_name ?? null,
                totalAmount: inv.totalAmount,
                currency: inv.currency,
            });
        }
        const f = session.form;
        const iso = f.issueDate.slice(0, 10);
        if (!f.createClientId.trim()) {
            return buildInvoiceCoverLetterModel({
                issueDateIso: iso,
                clientName: session.meta.clientLabel ?? 'Company Name',
                clientAddress: null,
                contactName: null,
                totalAmount: null,
                currency: 'EUR',
            });
        }
        const client = await getTimeManagerClient(f.createClientId);
        return buildInvoiceCoverLetterModel({
            issueDateIso: iso,
            clientName: client.name,
            clientAddress: client.address,
            contactName: client.contact_name ?? null,
            totalAmount: null,
            currency: client.currency || 'EUR',
        });
    }
    catch {
        return buildInvoiceCoverLetterModel(fallbackInput());
    }
}
