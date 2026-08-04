import type { ChangeEvent } from 'react';
import { coverLetterheadLogoUrl } from '@pages/invoice-preview/lib/invoiceCoverLogoRaster';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import {
    CORRESPONDENCE_LETTERHEAD_CONTACT,
    formatOutgoingLetterheadDate,
    formatOutgoingRefLine,
} from '../lib/correspondenceLetterhead';
import { CorrespondenceLetterBodyEditor } from './CorrespondenceLetterBodyEditor';

export {
    CORRESPONDENCE_LETTERHEAD_CONTACT,
    formatOutgoingLetterheadDate,
    formatOutgoingRefLine,
} from '../lib/correspondenceLetterhead';

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
    const bodyHtml = coverModel.introParagraphOverride ?? '';

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

            <div className="corr-letter__body">
                <CorrespondenceLetterBodyEditor
                    value={bodyHtml}
                    editable={editable}
                    placeholder="Начните писать письмо — как в Word. Можно выделять текст и форматировать панелькой сверху."
                    onChange={(html) => onCoverModelChange?.({ introParagraphOverride: html || null })}
                />
            </div>
        </div>
    );
}
