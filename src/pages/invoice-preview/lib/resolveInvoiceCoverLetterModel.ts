import { getInvoice, getTimeManagerClient, listAllClientProjectsMerged } from '@entities/time-tracking';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { buildInvoiceCoverLetterModel, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { coverLanguageFromRecordsLanguage, type InvoiceCoverLanguage } from './invoiceCoverLetterI18n';

function fallbackInput(coverLanguage: InvoiceCoverLanguage = 'ENG') {
    const iso = new Date().toISOString().slice(0, 10);
    return {
        issueDateIso: iso,
        clientName: 'Company Name',
        clientAddress: null as string | null,
        contactName: null as string | null,
        totalAmount: null as number | null,
        currency: 'EUR',
        coverLanguage,
    };
}

async function resolveCoverLanguageFromSession(session: InvoicePreviewSessionV1): Promise<InvoiceCoverLanguage> {
    try {
        let projectId: string | null = null;
        if (session.mode === 'existing') {
            const inv = await getInvoice(session.invoiceId, true);
            projectId = inv.projectId?.trim() || null;
        }
        else {
            projectId = session.form.createProjectId.trim() || null;
        }
        if (!projectId)
            return 'ENG';
        const projects = await listAllClientProjectsMerged(true);
        const project = projects.find((p) => p.id === projectId);
        return coverLanguageFromRecordsLanguage(project?.records_language);
    }
    catch {
        return 'ENG';
    }
}

export async function resolveInvoiceCoverLetterModel(session: InvoicePreviewSessionV1 | null): Promise<InvoiceCoverLetterModel> {
    if (!session)
        return buildInvoiceCoverLetterModel(fallbackInput());
    const coverLanguage = await resolveCoverLanguageFromSession(session);
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
                coverLanguage,
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
                coverLanguage,
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
            coverLanguage,
        });
    }
    catch {
        return buildInvoiceCoverLetterModel(fallbackInput(coverLanguage));
    }
}
