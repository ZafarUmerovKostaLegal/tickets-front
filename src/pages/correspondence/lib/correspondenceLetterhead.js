import { formatCoverLetterDate } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
/** Contact block as on the official outgoing letterhead mock. */
export const CORRESPONDENCE_LETTERHEAD_CONTACT = {
    addressLine1: '18 Anhor buyi str.,',
    addressLine2: 'Tashkent, 100011, Uzbekistan',
    phone: 'tel.: +998 71 209 02 40',
    email: 'info@kostalegal.com',
    web: 'www.kostalegal.com',
};
export function formatOutgoingRefLine(registryNumber) {
    const raw = (registryNumber ?? '').trim();
    if (!raw || /^исх-?черновик$/i.test(raw))
        return 'Исх. № —';
    if (/^исх\.?\s*№/i.test(raw)) {
        const rest = raw.replace(/^исх\.?\s*№\s*/i, '').trim();
        return rest ? `Исх. № ${rest}` : 'Исх. № —';
    }
    if (/^исх/i.test(raw)) {
        const rest = raw.replace(/^исх\.?\s*-?\s*/i, '').replace(/^№\s*/i, '').trim();
        return rest ? `Исх. № ${rest}` : 'Исх. № —';
    }
    return `Исх. № ${raw}`;
}
export function formatOutgoingLetterheadDate(model) {
    const custom = model.letterDateDisplay?.trim();
    if (custom)
        return custom.replace(/\s*г\.\s*$/i, '').trim();
    const formatted = formatCoverLetterDate(model.issueDateIso, 'RU');
    return formatted.replace(/\s*г\.\s*$/i, '').trim();
}
