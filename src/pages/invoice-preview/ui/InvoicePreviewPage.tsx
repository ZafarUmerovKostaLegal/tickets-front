import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@shared/config';
import { AppPageSettings, useAppToast } from '@shared/ui';
import { OPEN_INVOICE_DETAIL_QUERY, readInvoicePreviewSession } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { buildInvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { buildInvoicePreviewDocxBlob } from '../lib/buildInvoicePreviewDocx';
import { buildInvoicePreviewPdfBlob } from '../lib/buildInvoicePreviewPdf';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '../lib/invoicePreviewDownload';
import { resolveInvoiceCoverLetterModel } from '../lib/resolveInvoiceCoverLetterModel';
import { InvoiceCoverLetter } from './InvoiceCoverLetter';
import '@pages/time-tracking/ui/TimeTrackingPage.css';
import './InvoicePreviewPage.css';

const INVOICES_TAB_BACK_RESUME_CREATE = `${routes.timeTracking}?tab=invoices&invoice_resume=1`;

function fallbackCoverModel(): InvoiceCoverLetterModel {
    const iso = new Date().toISOString().slice(0, 10);
    return buildInvoiceCoverLetterModel({
        issueDateIso: iso,
        clientName: 'Company Name',
        clientAddress: null,
        contactName: null,
        totalAmount: null,
        currency: 'EUR',
    });
}

export function InvoicePreviewPage() {
    const { pushToast } = useAppToast();
    const [downloadBusy, setDownloadBusy] = useState<'word' | 'pdf' | null>(null);
    const session = useMemo(() => readInvoicePreviewSession(), []);
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel | null>(null);

    useEffect(() => {
        let cancel = false;
        void resolveInvoiceCoverLetterModel(session).then((m) => {
            if (!cancel)
                setCoverModel(m);
        });
        return () => {
            cancel = true;
        };
    }, [session]);

    const displayModel = coverModel ?? fallbackCoverModel();

    const subtitleParts = session?.mode === 'existing'
        ? [session.meta.invoiceNumber, session.meta.clientLabel].filter(Boolean)
        : [session?.meta.clientLabel, session?.meta.projectLabel].filter(Boolean);
    const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : null;

    const defaultFilename = useMemo(() => {
        if (!session)
            return 'Schet_predprosmotr';
        if (session.mode === 'existing') {
            return buildInvoicePreviewExportBasename({
                invoiceNumber: session.meta.invoiceNumber,
                clientLabel: session.meta.clientLabel,
                issueDateIso: session.meta.issueDateIso,
            });
        }
        return buildInvoicePreviewExportBasename({
            clientLabel: session.meta.clientLabel,
            issueDateIso: session.form.issueDate.slice(0, 10),
        });
    }, [session]);

    const backHref = session?.mode === 'existing'
        ? `${routes.timeTracking}?tab=invoices&${OPEN_INVOICE_DETAIL_QUERY}=${encodeURIComponent(session.invoiceId)}`
        : INVOICES_TAB_BACK_RESUME_CREATE;

    const handleDownloadWord = useCallback(async () => {
        const model = coverModel ?? fallbackCoverModel();
        setDownloadBusy('word');
        try {
            const blob = await buildInvoicePreviewDocxBlob(model);
            triggerBrowserDownload(blob, `${defaultFilename}.docx`);
        }
        catch (e) {
            pushToast({
                variant: 'error',
                message: e instanceof Error ? e.message : 'Не удалось сформировать документ Word',
            });
        }
        finally {
            setDownloadBusy(null);
        }
    }, [coverModel, defaultFilename, pushToast]);

    const handleDownloadPdf = useCallback(async () => {
        const model = coverModel ?? fallbackCoverModel();
        setDownloadBusy('pdf');
        try {
            const blob = await buildInvoicePreviewPdfBlob(model);
            triggerBrowserDownload(blob, `${defaultFilename}.pdf`);
        }
        catch (e) {
            pushToast({
                variant: 'error',
                message: e instanceof Error ? e.message : 'Не удалось сформировать PDF',
            });
        }
        finally {
            setDownloadBusy(null);
        }
    }, [coverModel, defaultFilename, pushToast]);

    return (<div className="tt-inv-preview">
      <nav className="time-page__navbar tt-inv-preview__navbar" aria-label="Предпросмотр счёта">
        <Link to={backHref} className="time-page__back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          <span className="time-page__back-label">Назад</span>
        </Link>
        <div className="time-page__navbar-sep" aria-hidden="true"/>
        <span className="time-page__navbar-title">Счета</span>
        <div className="time-page__navbar-sep" aria-hidden="true"/>
        <div className="time-page__navbar-tabs" role="tablist" aria-label="Текущий раздел">
          <span className="time-page__navbar-tab time-page__navbar-tab--active" role="tab" aria-selected="true" tabIndex={-1}>
            Предпросмотр
          </span>
        </div>
        <div className="time-page__navbar-spacer"/>
        <div className="tt-inv-preview__downloads" role="group" aria-label="Скачать предпросмотр">
          <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn" disabled={downloadBusy != null} onClick={() => void handleDownloadPdf()}>
            {downloadBusy === 'pdf' ? 'Подготовка…' : 'Скачать PDF'}
          </button>
          <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-inv-preview__download-btn" disabled={downloadBusy != null} onClick={() => void handleDownloadWord()}>
            {downloadBusy === 'word' ? 'Подготовка…' : 'Скачать Word'}
          </button>
        </div>
        <div className="time-page__navbar-settings">
          <AppPageSettings />
        </div>
      </nav>

      <main className="tt-inv-preview__main">
        <header className="tt-inv-preview__header">
          <h1 className="tt-inv-preview__title">Предпросмотр</h1>
          <p className="tt-inv-preview__note">
            Первая страница — сопроводительное письмо в адрес клиента; второй и третий лист зарезервированы под счёт и приложения.
          </p>
          {subtitle && (<p className="tt-inv-preview__context">{subtitle}</p>)}
          {!coverModel && (<p className="tt-inv-preview__loading-hint" role="status">Подтягиваем реквизиты клиента…</p>)}
        </header>

        <div className="tt-inv-preview__viewer">
          <aside className="tt-inv-preview__thumbs" aria-label="Миниатюры страниц">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                className={`tt-inv-preview__thumb${num === 1 ? ' tt-inv-preview__thumb--active' : ''}`}
                aria-current={num === 1 ? 'page' : undefined}
                aria-label={`Страница ${num} из 3${num === 1 ? ', сопроводительное письмо' : ''}`}
              >
                <span className="tt-inv-preview__thumb-sheet" aria-hidden/>
                <span className="tt-inv-preview__thumb-num">{num}</span>
              </button>
            ))}
          </aside>
          <div className="tt-inv-preview__sheet-stack" aria-label="Макет печати">
            <div className="tt-inv-preview__pages">
              <div className="tt-inv-a4-page tt-inv-a4-page--cover" aria-label="Страница 1 из 3 — сопроводительное письмо">
                <InvoiceCoverLetter model={displayModel}/>
              </div>
              <div className="tt-inv-a4-page" aria-label="Страница 2 из 3"/>
              <div className="tt-inv-a4-page" aria-label="Страница 3 из 3"/>
            </div>
          </div>
        </div>
      </main>
    </div>);
}
