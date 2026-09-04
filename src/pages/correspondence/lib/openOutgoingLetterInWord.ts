import { buildInvoiceCoverLetterModel, type InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildOutgoingLetterDocxBlob, outgoingLetterDocxFileName } from './buildOutgoingLetterDocx';
import { triggerPdfDownload } from './correspondencePdfEditorModel';

/** Word for the web (Microsoft 365). The downloaded template is opened via File → Open → Upload. */
export const WORD_ONLINE_LAUNCH_URL = 'https://www.office.com/launch/word?auth=2';

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isWordLetterFile(file: File): boolean {
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx') || name.endsWith('.doc'))
        return true;
    const type = (file.type || '').toLowerCase();
    return type.includes('word') || type.includes('officedocument.wordprocessingml');
}

export function pickOutgoingWordFile(files: File[]): File | undefined {
    return files.find(isWordLetterFile);
}

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

export function defaultOutgoingLetterCoverModel(): InvoiceCoverLetterModel {
    return buildInvoiceCoverLetterModel({
        issueDateIso: todayIso(),
        clientName: '',
        clientAddress: null,
        contactName: null,
        totalAmount: null,
        currency: 'USD',
        coverLanguage: 'RU',
    });
}

export async function downloadOutgoingLetterTemplate(
    model?: InvoiceCoverLetterModel,
    opts?: { subject?: string; registryNumber?: string | null },
): Promise<File> {
    const cover = model ?? defaultOutgoingLetterCoverModel();
    const blob = await buildOutgoingLetterDocxBlob(cover, { registryNumber: opts?.registryNumber });
    const name = outgoingLetterDocxFileName(opts?.subject ?? '', cover.issueDateIso);
    triggerPdfDownload(blob, name);
    return new File([blob], name, { type: WORD_MIME });
}

/** Download letterhead .docx and open Word Online so the user can write, then File → Download a Copy. */
export async function openOutgoingLetterInWordOnline(
    model?: InvoiceCoverLetterModel,
    opts?: { subject?: string; registryNumber?: string | null },
): Promise<File> {
    const file = await downloadOutgoingLetterTemplate(model, opts);
    window.open(WORD_ONLINE_LAUNCH_URL, '_blank', 'noopener,noreferrer');
    return file;
}
