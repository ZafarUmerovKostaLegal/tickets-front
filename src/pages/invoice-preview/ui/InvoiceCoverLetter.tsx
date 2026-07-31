import type { ChangeEvent } from 'react';
import { SearchableSelect } from '@shared/ui';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import {
    COVER_SIGNATORY_PARTNERS,
    coverSignaturePublicUrl,
    resolveCoverSignatoryPartner,
    type CoverSignatoryPartner,
} from '../lib/invoiceCoverSignature';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import {
    KOSTA_LEGAL_FIRM,
    getCoverLetterLabels,
    resolveCoverIntroParagraph,
    resolveCoverInvoiceParagraph,
} from '../lib/invoiceCoverLetterModel';
import './InvoiceCoverLetter.css';

type InvoiceCoverLetterProps = {
    model: InvoiceCoverLetterModel;
    editable?: boolean;
    onChange?: (patch: Partial<InvoiceCoverLetterModel>) => void;

    secondParagraphMode?: 'invoice' | 'freeform';
};

function CoverField({
    className,
    value,
    onChange,
    editable,
    multiline,
    ariaLabel,
}: {
    className?: string;
    value: string;
    onChange?: (next: string) => void;
    editable?: boolean;
    multiline?: boolean;
    ariaLabel?: string;
}) {
    if (!editable) {
        return <span className={className}>{value}</span>;
    }
    const shared = {
        className: `tt-inv-cover__field${className ? ` ${className}` : ''}`,
        value,
        'aria-label': ariaLabel,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange?.(e.target.value),
    };
    if (multiline) {
        return <textarea {...shared} rows={2} />;
    }
    return <input type="text" {...shared} />;
}

function resolveActiveSignatory(model: InvoiceCoverLetterModel): CoverSignatoryPartner | null {
    return resolveCoverSignatoryPartner({
        initials: model.signatoryInitials,
        name: model.signatoryName,
    });
}

export function InvoiceCoverLetter({
    model,
    editable = false,
    onChange,
    secondParagraphMode = 'invoice',
}: InvoiceCoverLetterProps) {
    const addr2 = model.recipientAddressLines[1];
    const patch = onChange;
    const labels = getCoverLetterLabels(model.coverLanguage);
    const introText = resolveCoverIntroParagraph(model);
    const invoiceText = resolveCoverInvoiceParagraph(model);
    const showSecondParagraph = secondParagraphMode === 'invoice'
        || editable
        || Boolean(model.invoiceParagraphOverride?.trim());
    const activePartner = resolveActiveSignatory(model);
    const signatureUrl = coverSignaturePublicUrl(activePartner);
    const partnerItems: CoverSignatoryPartner[] = (() => {
        if (activePartner || !model.signatoryName.trim())
            return [...COVER_SIGNATORY_PARTNERS];
        return [
            {
                initials: '__current__',
                displayName: model.signatoryName.trim(),
                fileName: '',
            },
            ...COVER_SIGNATORY_PARTNERS,
        ];
    })();
    const selectValue = activePartner?.initials
        ?? (model.signatoryName.trim() ? '__current__' : '');

    return (<div className={`tt-inv-cover${editable ? ' tt-inv-cover--editable' : ''}`}>
      <header className="tt-inv-cover__header">
        <div className="tt-inv-cover__brand">
          <img className="tt-inv-cover__logo" src={coverLetterheadLogoUrl()} alt="" decoding="async"/>
        </div>
        <address className="tt-inv-cover__firm-contact">
          <span className="tt-inv-cover__firm-contact-group">
            <span>{KOSTA_LEGAL_FIRM.addressLine}</span>
            <span>{KOSTA_LEGAL_FIRM.phone}</span>
          </span>
          <span className="tt-inv-cover__firm-contact-group">
            <span>{KOSTA_LEGAL_FIRM.email}</span>
            <span>{KOSTA_LEGAL_FIRM.web}</span>
          </span>
        </address>
      </header>

      <div className="tt-inv-cover__letter-body">
        <p className="tt-inv-cover__date">
          <CoverField
            editable={editable}
            value={model.letterDateDisplay}
            ariaLabel="Дата письма"
            onChange={(letterDateDisplay) => patch?.({ letterDateDisplay })}
          />
        </p>

        <div className="tt-inv-cover__recipient">
          <p className="tt-inv-cover__recipient-line tt-inv-cover__recipient-line--company">
            <CoverField
              editable={editable}
              value={model.recipientCompany}
              ariaLabel="Компания получателя"
              onChange={(recipientCompany) => patch?.({ recipientCompany, quotedCompanyName: recipientCompany })}
            />
          </p>
          <p className="tt-inv-cover__recipient-line">
            <CoverField
              editable={editable}
              value={model.recipientAddressLines[0]}
              ariaLabel="Адрес получателя, строка 1"
              onChange={(line0) => patch?.({
                recipientAddressLines: [line0, model.recipientAddressLines[1] ?? ''],
              })}
            />
          </p>
          {editable || addr2 ? (
            <p className="tt-inv-cover__recipient-line">
              <CoverField
                editable={editable}
                value={addr2 ?? ''}
                ariaLabel="Адрес получателя, строка 2"
                multiline={editable}
                onChange={(line1) => patch?.({
                  recipientAddressLines: [model.recipientAddressLines[0], line1],
                })}
              />
            </p>
          ) : null}
        </div>

        <p className="tt-inv-cover__attention">
          {labels.attention}:{' '}
          <CoverField
            editable={editable}
            value={model.attentionName}
            ariaLabel="Имя контактного лица"
            onChange={(attentionName) => patch?.({ attentionName })}
          />
        </p>
        <p className="tt-inv-cover__attention-sub">
          <CoverField
            editable={editable}
            value={model.attentionTitle}
            ariaLabel="Должность контактного лица"
            onChange={(attentionTitle) => patch?.({ attentionTitle })}
          />
        </p>

        <p className="tt-inv-cover__salutation">
          {labels.dear}{' '}
          <CoverField
            editable={editable}
            value={model.attentionName}
            ariaLabel="Обращение, имя"
            onChange={(attentionName) => patch?.({ attentionName })}
          />,
        </p>

        {editable ? (
          <textarea
            className="tt-inv-cover__field tt-inv-cover__field--para"
            rows={3}
            aria-label="Первый абзац письма"
            value={introText}
            onChange={(e) => patch?.({ introParagraphOverride: e.target.value })}
          />
        ) : (
          <p className="tt-inv-cover__para">{introText}</p>
        )}

        {showSecondParagraph ? (
          editable ? (
            <textarea
              className="tt-inv-cover__field tt-inv-cover__field--para"
              rows={3}
              aria-label={secondParagraphMode === 'invoice' ? 'Второй абзац письма' : 'Дополнительный абзац'}
              placeholder={secondParagraphMode === 'freeform' ? 'Дополнительный абзац (необязательно)' : undefined}
              value={invoiceText}
              onChange={(e) => patch?.({ invoiceParagraphOverride: e.target.value })}
            />
          ) : (
            <p className="tt-inv-cover__para">{invoiceText}</p>
          )
        ) : null}

        <p className="tt-inv-cover__closing">{labels.closing}</p>

        <div className="tt-inv-cover__signature">
          {signatureUrl ? (
            <img
              className="tt-inv-cover__sig-image"
              src={signatureUrl}
              alt=""
              decoding="async"
            />
          ) : (
            <span className="tt-inv-cover__sig-image tt-inv-cover__sig-image--empty" aria-hidden/>
          )}
          <span className="tt-inv-cover__sig-line" aria-hidden/>
          <p className="tt-inv-cover__sig-name">
            {editable ? (
              <SearchableSelect<CoverSignatoryPartner>
                className="tt-inv-cover__partner-select"
                buttonClassName="tt-inv-cover__field tt-inv-cover__partner-select-btn"
                value={selectValue}
                items={partnerItems}
                getOptionValue={(p) => p.initials}
                getOptionLabel={(p) => p.displayName}
                getSearchText={(p) => `${p.displayName} ${p.initials === '__current__' ? '' : p.initials}`}
                onSelect={(p) => {
                    if (p.initials === '__current__')
                        return;
                    patch?.({
                        signatoryName: p.displayName,
                        signatoryInitials: p.initials,
                    });
                }}
                placeholder="Выберите партнёра"
                emptyListText="Нет партнёров"
                noMatchText="Ничего не найдено"
                portalDropdown
                portalZIndex={12000}
                portalMinWidth={240}
              />
            ) : (
              <span>{model.signatoryName}</span>
            )}
          </p>
          <p className="tt-inv-cover__sig-title">
            <CoverField
              editable={editable}
              value={model.signatoryTitle}
              ariaLabel="Должность подписанта"
              onChange={(signatoryTitle) => patch?.({ signatoryTitle })}
            />
          </p>
        </div>
      </div>
    </div>);
}
