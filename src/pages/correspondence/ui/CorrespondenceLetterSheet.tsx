import type { ChangeEvent } from 'react';
import { coverLetterheadLogoUrl } from '@pages/invoice-preview/lib/invoiceCoverLogoRaster';
import { formatCoverLetterDate, type InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';

/** Contact block as on the official outgoing letterhead mock. */
export const CORRESPONDENCE_LETTERHEAD_CONTACT = {
    addressLine1: '18 Anhor buyi str.,',
    addressLine2: 'Tashkent, 100011, Uzbekistan',
    phone: 'tel.: +998 71 209 02 40',
    email: 'info@kostalegal.com',
    web: 'www.kostalegal.com',
} as const;

export function formatOutgoingRefLine(registryNumber: string | null | undefined): string {
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

export function formatOutgoingLetterheadDate(
    model: Pick<InvoiceCoverLetterModel, 'letterDateDisplay' | 'issueDateIso' | 'coverLanguage'>,
): string {
    const custom = model.letterDateDisplay?.trim();
    if (custom)
        return custom.replace(/\s*г\.\s*$/i, '').trim();
    const formatted = formatCoverLetterDate(model.issueDateIso, 'RU');
    return formatted.replace(/\s*г\.\s*$/i, '').trim();
}

type FieldProps = {
    className?: string;
    value: string;
    editable?: boolean;
    ariaLabel?: string;
    onChange?: (next: string) => void;
};

function LetterField({ className, value, editable, ariaLabel, onChange }: FieldProps) {
    if (!editable) {
        return <span className={className}>{value}</span>;
    }
    return (
        <input
            type="text"
            className={`corr-letter__field${className ? ` ${className}` : ''}`}
            value={value}
            aria-label={ariaLabel}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
        />
    );
}

export type CorrespondenceLetterSheetProps = {
    coverModel: InvoiceCoverLetterModel;
    registryNumber?: string | null;
    editable?: boolean;
    onCoverModelChange?: (patch: Partial<InvoiceCoverLetterModel>) => void;
};

export function CorrespondenceLetterSheet({
    coverModel,
    registryNumber,
    editable = false,
    onCoverModelChange,
}: CorrespondenceLetterSheetProps) {
    const refLine = formatOutgoingRefLine(registryNumber);
    const dateValue = formatOutgoingLetterheadDate(coverModel);
    const dateLinePrefix = 'Дата: ';

    return (
        <div
            className={`corr-letter${editable ? ' corr-letter--editable' : ''}`}
            aria-label={editable ? 'Лист исходящего письма' : 'Лист письма'}
        >
            <header className="corr-letter__header">
                <div className="corr-letter__brand-col">
                    <div className="corr-letter__brand">
                        <img
                            className="corr-letter__logo"
                            src={coverLetterheadLogoUrl()}
                            alt="KOSTA LEGAL"
                            decoding="async"
                        />
                    </div>
                    <div className="corr-letter__meta">
                        <p className="corr-letter__meta-line">{refLine}</p>
                        <p className="corr-letter__meta-line">
                            <span className="corr-letter__meta-label">{dateLinePrefix}</span>
                            <LetterField
                                editable={editable}
                                className="corr-letter__meta-date"
                                value={dateValue}
                                ariaLabel="Дата письма"
                                onChange={(letterDateDisplay) => onCoverModelChange?.({ letterDateDisplay })}
                            />
                        </p>
                    </div>
                </div>
                <address className="corr-letter__contact">
                    <span>{CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine1}</span>
                    <span>{CORRESPONDENCE_LETTERHEAD_CONTACT.addressLine2}</span>
                    <span>{CORRESPONDENCE_LETTERHEAD_CONTACT.phone}</span>
                    <span>{CORRESPONDENCE_LETTERHEAD_CONTACT.email}</span>
                    <span>{CORRESPONDENCE_LETTERHEAD_CONTACT.web}</span>
                </address>
            </header>
            <div className="corr-letter__body" aria-hidden={!editable} />
        </div>
    );
}
