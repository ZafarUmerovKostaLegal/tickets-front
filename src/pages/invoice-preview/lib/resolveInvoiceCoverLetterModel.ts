import { getInvoice, getTimeManagerClient, listAllClientProjectsMerged, listTimeTrackingUsers, readProjectRecordsLanguage } from '@entities/time-tracking';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { buildInvoiceCoverLetterModel, KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
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

async function resolveProjectIdFromSession(session: InvoicePreviewSessionV1): Promise<string | null> {
    if (session.mode === 'existing') {
        const inv = await getInvoice(session.invoiceId, true);
        return inv.projectId?.trim() || null;
    }
    return session.form.createProjectId.trim() || null;
}

async function resolveCoverLanguageFromSession(session: InvoicePreviewSessionV1): Promise<InvoiceCoverLanguage> {
    try {
        const projectId = await resolveProjectIdFromSession(session);
        if (!projectId)
            return 'ENG';
        const projects = await listAllClientProjectsMerged(true);
        const project = projects.find((p) => p.id === projectId);
        return coverLanguageFromRecordsLanguage(project ? readProjectRecordsLanguage(project) : null);
    }
    catch {
        return 'ENG';
    }
}

async function resolveProjectPartnerName(session: InvoicePreviewSessionV1): Promise<string | null> {
    try {
        const projectId = await resolveProjectIdFromSession(session);
        if (!projectId)
            return null;
        const [projects, users] = await Promise.all([
            listAllClientProjectsMerged(true),
            listTimeTrackingUsers().catch(() => []),
        ]);
        const project = projects.find((p) => p.id === projectId);
        const partnerIds: number[] = project?.partnerAuthUserIds ?? [];
        if (partnerIds.length === 0)
            return null;
        const partnerUser = users.find((u) => partnerIds.includes(u.id));
        if (!partnerUser)
            return null;
        return (partnerUser.display_name ?? '').trim() || null;
    }
    catch {
        return null;
    }
}

export async function resolveInvoiceCoverLetterModel(session: InvoicePreviewSessionV1 | null): Promise<InvoiceCoverLetterModel> {
    if (!session)
        return buildInvoiceCoverLetterModel(fallbackInput());
    const [coverLanguage, partnerName] = await Promise.all([
        resolveCoverLanguageFromSession(session),
        resolveProjectPartnerName(session),
    ]);
    const signatoryName = partnerName || KOSTA_LEGAL_FIRM.defaultSignatoryName;
    try {
        if (session.mode === 'existing') {
            const inv = await getInvoice(session.invoiceId, true);
            const client = await getTimeManagerClient(inv.clientId);
            const model = buildInvoiceCoverLetterModel({
                issueDateIso: inv.issueDate.slice(0, 10),
                clientName: client.name,
                clientAddress: client.address,
                contactName: client.contact_name ?? null,
                totalAmount: inv.totalAmount,
                currency: inv.currency,
                coverLanguage,
            });
            return { ...model, signatoryName };
        }
        const f = session.form;
        const iso = f.issueDate.slice(0, 10);
        if (!f.createClientId.trim()) {
            const model = buildInvoiceCoverLetterModel({
                issueDateIso: iso,
                clientName: session.meta.clientLabel ?? 'Company Name',
                clientAddress: null,
                contactName: null,
                totalAmount: null,
                currency: 'EUR',
                coverLanguage,
            });
            return { ...model, signatoryName };
        }
        const client = await getTimeManagerClient(f.createClientId);
        const model = buildInvoiceCoverLetterModel({
            issueDateIso: iso,
            clientName: client.name,
            clientAddress: client.address,
            contactName: client.contact_name ?? null,
            totalAmount: null,
            currency: client.currency || 'EUR',
            coverLanguage,
        });
        return { ...model, signatoryName };
    }
    catch {
        const model = buildInvoiceCoverLetterModel(fallbackInput(coverLanguage));
        return { ...model, signatoryName };
    }
}
