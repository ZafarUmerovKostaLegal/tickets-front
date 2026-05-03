import letterheadFullLogoUrl from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?url';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { KOSTA_LEGAL_FIRM } from '../lib/invoiceCoverLetterModel';
import './InvoiceCoverLetter.css';

export function InvoiceCoverLetter({ model }: { model: InvoiceCoverLetterModel }) {
    const addr2 = model.recipientAddressLines[1];
    return (<div className="tt-inv-cover">
      <header className="tt-inv-cover__header">
        <div className="tt-inv-cover__brand">
          <img className="tt-inv-cover__logo" src={letterheadFullLogoUrl} alt="" decoding="async"/>
        </div>
        <address className="tt-inv-cover__firm-contact">
          <span>{KOSTA_LEGAL_FIRM.addressLine}</span>
          <span>{KOSTA_LEGAL_FIRM.phone}</span>
          <span>{KOSTA_LEGAL_FIRM.email}</span>
          <span>{KOSTA_LEGAL_FIRM.web}</span>
        </address>
      </header>

      <div className="tt-inv-cover__letter-body">
        <p className="tt-inv-cover__date">{model.letterDateDisplay}</p>

        <div className="tt-inv-cover__recipient">
          <p className="tt-inv-cover__recipient-line">{model.recipientCompany}</p>
          <p className="tt-inv-cover__recipient-line">{model.recipientAddressLines[0]}</p>
          {addr2 ? <p className="tt-inv-cover__recipient-line">{addr2}</p> : null}
        </div>

        <p className="tt-inv-cover__attention">
          Attention: {model.attentionName}
        </p>
        <p className="tt-inv-cover__attention-sub">{model.attentionTitle}</p>

        <p className="tt-inv-cover__salutation">Dear {model.attentionName},</p>

        <p className="tt-inv-cover__para">
          It is our pleasure to provide legal assistance to «{model.quotedCompanyName}» in connection with its activities in Uzbekistan.
        </p>

        <p className="tt-inv-cover__para">
          Herewith, we are sending the report <strong>or/and </strong>
          with the invoice on legal services rendered in{' '}
          <strong>{model.servicesMonthYear}</strong>
          {' '}for the total amount of <strong>{model.totalFormatted}</strong>.
        </p>

        <p className="tt-inv-cover__closing">Kind regards,</p>

        <div className="tt-inv-cover__signature">
          <span className="tt-inv-cover__sig-line" aria-hidden/>
          <p className="tt-inv-cover__sig-name">{model.signatoryName}</p>
          <p className="tt-inv-cover__sig-title">{model.signatoryTitle}</p>
        </div>
      </div>
    </div>);
}
