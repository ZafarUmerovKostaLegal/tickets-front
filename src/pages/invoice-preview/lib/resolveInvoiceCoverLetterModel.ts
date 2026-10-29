import {
    fetchUnbilledExpenses,
    fetchUnbilledTimeEntries,
    getInvoice,
    getTimeManagerClient,
    listAllClientProjectsMerged,
    listTimeTrackingUsers,
    readProjectRecordsLanguage,
} from '@entities/time-tracking';
import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { invoiceFixedFeeTotal } from '@pages/time-tracking/lib/invoiceFixedFee';
import { billingPeriodBoundsFromIsoDates, inferBillingPeriodIsoFromDates } from '@pages/time-tracking/lib/invoicePageShared';
import { buildInvoiceCoverLetterModel, KOSTA_LEGAL_FIRM, type InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { coverLanguageFromRecordsLanguage, type InvoiceCoverLanguage } from './invoiceCoverLetterI18n';
import {
    normalizeCoverSignatureCode,
    resolveCoverSignatoryPartner,
} from './invoiceCoverSignature';

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

type ResolvedSignatory = {
    signatoryName: string;
    signatoryInitials: string;
};

function resolveSignatoryFromPartner(name: string | null, initialsRaw: string | null): ResolvedSignatory {
    const partner = resolveCoverSignatoryPartner({ name, initials: initialsRaw });
    if (partner) {
        return {
            signatoryName: partner.displayName,
            signatoryInitials: partner.initials,
        };
    }
    const code = normalizeCoverSignatureCode(initialsRaw);
    if (code) {
        return {
            signatoryName: name?.trim() || KOSTA_LEGAL_FIRM.defaultSignatoryName,
            signatoryInitials: code,
        };
    }
    if (!name?.trim()) {
        return {
            signatoryName: KOSTA_LEGAL_FIRM.defaultSignatoryName,
            signatoryInitials: 'AAA',
        };
    }
    return {
        signatoryName: name.trim(),
        signatoryInitials: '',
    };
}

async function resolveProjectPartnerSignatory(session: InvoicePreviewSessionV1): Promise<ResolvedSignatory> {
    try {
        const projectId = await resolveProjectIdFromSession(session);
        if (!projectId)
            return resolveSignatoryFromPartner(null, null);
        const [projects, users] = await Promise.all([
            listAllClientProjectsMerged(true),
            listTimeTrackingUsers().catch(() => []),
        ]);
        const project = projects.find((p) => p.id === projectId);
        const partnerIds: number[] = project?.partnerAuthUserIds ?? [];
        if (partnerIds.length === 0)
            return resolveSignatoryFromPartner(null, null);
        const partnerUser = users.find((u) => partnerIds.includes(u.id));
        if (!partnerUser)
            return resolveSignatoryFromPartner(null, null);
        const name = (partnerUser.display_name ?? '').trim() || null;
        const initials = (partnerUser.initials ?? '').trim() || null;
        return resolveSignatoryFromPartner(name, initials);
    }
    catch {
        return resolveSignatoryFromPartner(null, null);
    }
}

function withSignatory(model: InvoiceCoverLetterModel, signatory: ResolvedSignatory): InvoiceCoverLetterModel {
    return {
        ...model,
        signatoryName: signatory.signatoryName,
        signatoryInitials: signatory.signatoryInitials,
    };
}

export async function resolveInvoiceCoverLetterModel(session: InvoicePreviewSessionV1 | null): Promise<InvoiceCoverLetterModel> {
    if (!session)
        return buildInvoiceCoverLetterModel(fallbackInput());
    const [coverLanguage, signatory] = await Promise.all([
        resolveCoverLanguageFromSession(session),
        resolveProjectPartnerSignatory(session),
    ]);
    try {
        if (session.mode === 'existing') {
            const inv = await getInvoice(session.invoiceId, true);
            const client = await getTimeManagerClient(inv.clientId);
            const issueIso = inv.issueDate.slice(0, 10);
            const periodTo = (
                session.meta.billingPeriodTo
                || inv.partnerBillingPeriodTo
            )?.toString().slice(0, 10) || '';
            const periodFrom = (
                session.meta.billingPeriodFrom
                || inv.partnerBillingPeriodFrom
            )?.toString().slice(0, 10) || '';
            const storedPeriod = periodTo || periodFrom;
            const lineDates = (inv.lines ?? []).flatMap((ln) => {
                const out: string[] = [];
                if (ln.timeEntryWorkDate)
                    out.push(ln.timeEntryWorkDate);
                if (ln.expenseDate)
                    out.push(ln.expenseDate);
                return out;
            });
            const inferred = inferBillingPeriodIsoFromDates(lineDates);
            const lineBounds = billingPeriodBoundsFromIsoDates(lineDates);
            let billingPeriodIso = storedPeriod;
            let billingPeriodFromIso = /^\d{4}-\d{2}-\d{2}$/.test(periodFrom) ? periodFrom : '';
            if (lineBounds) {
                billingPeriodFromIso = lineBounds.from;
                billingPeriodIso = lineBounds.to;
            }
            else if (inferred && (
                !/^\d{4}-\d{2}-\d{2}$/.test(storedPeriod)
                || storedPeriod.slice(0, 7) !== inferred.slice(0, 7)
            )) {
                billingPeriodIso = inferred;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(billingPeriodIso))
                billingPeriodIso = issueIso;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(billingPeriodFromIso))
                billingPeriodFromIso = billingPeriodIso;
            const { resolveInvoiceDisplayMoney } = await import('@pages/time-tracking/lib/invoiceExpenseLineDisplay');
            const displayMoney = await resolveInvoiceDisplayMoney(inv);
            const extraFixedFeeAmount = invoiceFixedFeeTotal(inv.lines);
            const model = buildInvoiceCoverLetterModel({
                issueDateIso: issueIso,
                billingPeriodIso,
                billingPeriodFromIso,
                clientName: client.name,
                clientAddress: client.address,
                contactName: client.contact_name ?? null,
                totalAmount: displayMoney.totalAmount,
                extraFixedFeeAmount,
                currency: inv.currency,
                coverLanguage,
            });
            return withSignatory(model, signatory);
        }
        const f = session.form;
        const iso = f.issueDate.slice(0, 10);
        let billingPeriodIso = (session.meta.billingPeriodTo || f.unbilledTo || f.unbilledFrom || iso).slice(0, 10);
        let billingPeriodFromIso = (session.meta.billingPeriodFrom || f.unbilledFrom || billingPeriodIso).slice(0, 10);
        const pid = f.createProjectId.trim();
        if (pid && (f.selTime.length > 0 || f.selExp.length > 0)) {
            try {
                const selT = new Set(f.selTime);
                const selE = new Set(f.selExp);
                const from = f.unbilledFrom.slice(0, 10);
                const to = f.unbilledTo.slice(0, 10);
                const [timeRows, expRows] = await Promise.all([
                    fetchUnbilledTimeEntries({ projectId: pid, dateFrom: from, dateTo: to }),
                    fetchUnbilledExpenses({ projectId: pid, dateFrom: from, dateTo: to }),
                ]);
                const dates = [
                    ...timeRows.filter((x) => selT.has(x.id)).map((x) => String(x.workDate ?? '').slice(0, 10)),
                    ...expRows.filter((x) => selE.has(x.id)).map((x) => String(x.expenseDate ?? '').slice(0, 10)),
                ];
                const bounds = billingPeriodBoundsFromIsoDates(dates);
                if (bounds) {
                    billingPeriodFromIso = bounds.from;
                    billingPeriodIso = bounds.to;
                }
            }
            catch {
                /* keep the loaded unbilled window if selected dates cannot be resolved */
            }
        }
        if (!f.createClientId.trim()) {
            const model = buildInvoiceCoverLetterModel({
                issueDateIso: iso,
                billingPeriodIso,
                billingPeriodFromIso,
                clientName: session.meta.clientLabel ?? 'Company Name',
                clientAddress: null,
                contactName: null,
                totalAmount: null,
                currency: 'EUR',
                coverLanguage,
            });
            return withSignatory(model, signatory);
        }
        const client = await getTimeManagerClient(f.createClientId);
        const model = buildInvoiceCoverLetterModel({
            issueDateIso: iso,
            billingPeriodIso,
            clientName: client.name,
            clientAddress: client.address,
            contactName: client.contact_name ?? null,
            billingPeriodFromIso,
            totalAmount: null,
            currency: client.currency || 'EUR',
            coverLanguage,
        });
        return withSignatory(model, signatory);
    }
    catch {
        const model = buildInvoiceCoverLetterModel(fallbackInput(coverLanguage));
        return withSignatory(model, signatory);
    }
}
