import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { routes } from '@shared/config';
import { AppPageSettings, useAppToast } from '@shared/ui';
import { OPEN_INVOICE_DETAIL_QUERY, readInvoicePreviewSession } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { buildInvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { emptyInvoiceTimeReportPack, type InvoiceTimeReportPack } from '../lib/invoiceTimeReportModel';
import { buildInvoicePreviewDocxBlob } from '../lib/buildInvoicePreviewDocx';
import { buildInvoicePreviewPdfBlob } from '../lib/buildInvoicePreviewPdf';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '../lib/invoicePreviewDownload';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { splitDetailRowsForPagedTimeReport } from '../lib/invoiceTimeReportChunking';
import { resolveInvoiceCoverLetterModel } from '../lib/resolveInvoiceCoverLetterModel';
import { resolveInvoiceTimeReportPack } from '../lib/resolveInvoiceTimeReportPack';
import { InvoiceCoverLetter } from './InvoiceCoverLetter';
import { InvoiceTimeReportPage } from './InvoiceTimeReportPage';
import { InvoiceLegalInvoicePage } from './InvoiceLegalInvoicePage';
import '@pages/time-tracking/ui/TimeTrackingPage.css';
import './InvoicePreviewPage.css';

const INVOICES_TAB_BACK_RESUME_CREATE = `${routes.timeTracking}?tab=invoices&invoice_resume=1`;

/** Логическая ширина листа A4 в окне предпросмотра (соответствует ~210mm при типичном dpi карты CSS). */
const INV_PREVIEW_PAGE_BASE_PX = 794;
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 250;
const SHEET_ZOOM_STEP = 10;

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
    const location = useLocation();
    const [downloadBusy, setDownloadBusy] = useState<'word' | 'pdf' | null>(null);
    const session = useMemo(() => readInvoicePreviewSession(), [location.key, location.pathname]);
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel | null>(null);
    const [timeReportPack, setTimeReportPack] = useState<InvoiceTimeReportPack | null>(null);
    const sheetStackRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [sheetZoomPct, setSheetZoomPct] = useState(100);

    const displayModel = useMemo(() => coverModel ?? fallbackCoverModel(), [coverModel]);

    const pagesZoomStyle = useMemo(() => ({
        zoom: `${sheetZoomPct}%`,
    } as CSSProperties), [sheetZoomPct]);

    const scrollToPage = useCallback((page: number) => {
        const root = sheetStackRef.current;
        const el = pageRefs.current[page - 1];
        if (!root || !el)
            return;
        const rootRect = root.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const nextTop = root.scrollTop + (elRect.top - rootRect.top) - 8;
        root.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        setActivePage(page);
    }, []);

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

    useEffect(() => {
        let cancel = false;
        void resolveInvoiceTimeReportPack(session, displayModel, {
            onPartnerConfirmationBlocked(message) {
                if (!cancel)
                    pushToast({ message, variant: 'warning' });
            },
        }).then((p) => {
            if (!cancel)
                setTimeReportPack(p);
        });
        return () => {
            cancel = true;
        };
    }, [session, displayModel, pushToast]);

    const timeReportFallback = useMemo(
        () => emptyInvoiceTimeReportPack(packCurrencyCode(displayModel)),
        [displayModel],
    );
    const resolvedTimeReportPack = timeReportPack ?? timeReportFallback;

    const timeReportChunks = useMemo(
        () => splitDetailRowsForPagedTimeReport(resolvedTimeReportPack.detailSlots),
        [resolvedTimeReportPack.detailSlots],
    );
    const pageCount = 1 + timeReportChunks.length + 1;

    useEffect(() => {
        setActivePage((prev) => (prev > pageCount ? pageCount : prev));
    }, [pageCount]);

    useEffect(() => {
        const root = sheetStackRef.current;
        if (!root)
            return;
        const els = pageRefs.current.filter((n): n is HTMLDivElement => n != null);
        if (els.length === 0)
            return;

        const obs = new IntersectionObserver(
            (entries) => {
                const best = entries
                    .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (!best?.target)
                    return;
                const idx = els.indexOf(best.target as HTMLDivElement);
                if (idx >= 0)
                    setActivePage(idx + 1);
            },
            { root, rootMargin: '-8% 0px -35% 0px', threshold: [0.1, 0.25, 0.45, 0.65, 0.85] },
        );

        for (const el of els)
            obs.observe(el);
        return () => obs.disconnect();
    }, [coverModel, pageCount]);

    const zoomOut = useCallback(() => {
        setSheetZoomPct((z) => Math.max(SHEET_ZOOM_MIN, z - SHEET_ZOOM_STEP));
    }, []);
    const zoomIn = useCallback(() => {
        setSheetZoomPct((z) => Math.min(SHEET_ZOOM_MAX, z + SHEET_ZOOM_STEP));
    }, []);
    const zoomReset = useCallback(() => setSheetZoomPct(100), []);
    const zoomFitWidth = useCallback(() => {
        const el = sheetStackRef.current;
        if (!el)
            return;
        const cs = window.getComputedStyle(el);
        const px = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
        const cw = Math.max(0, el.clientWidth - (Number.isFinite(px) ? px : 48));
        const next = Math.round((cw / INV_PREVIEW_PAGE_BASE_PX) * 100);
        setSheetZoomPct(Math.min(SHEET_ZOOM_MAX, Math.max(SHEET_ZOOM_MIN, next)));
    }, []);

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
            const blob = await buildInvoicePreviewDocxBlob({ model, session });
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
    }, [coverModel, defaultFilename, pushToast, session]);

    const handleDownloadPdf = useCallback(async () => {
        const model = coverModel ?? fallbackCoverModel();
        setDownloadBusy('pdf');
        try {
            const blob = await buildInvoicePreviewPdfBlob({ model, session });
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
    }, [coverModel, defaultFilename, pushToast, session]);

    const toolbarTitle = subtitle ?? defaultFilename;
    const trRangeEnd = 1 + timeReportChunks.length;
    const pdfToolbarTip = `Лист 1 — сопроводительное письмо; листы 2–${trRangeEnd} — отчёт времени${timeReportChunks.length > 1 ? ' (продолжение при большом объёме)' : ''}; лист ${pageCount} — счёт (invoice). Масштаб: кнопки − / +, «По ширине» подгоняет лист к окну.`;

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
        <div className="tt-inv-preview__viewer" aria-label="Область просмотра документа">
          <aside className="tt-inv-preview__thumbs" aria-label="Миниатюры страниц">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => {
                const kind = num === 1 ? 'сопроводительное письмо' : num === pageCount ? 'счёт' : 'time report';
                const thumbTrIdx = num >= 2 && num < pageCount ? num - 2 : null;
                return (
                  <button
                    key={num}
                    type="button"
                    className={`tt-inv-preview__thumb${num === activePage ? ' tt-inv-preview__thumb--active' : ''}`}
                    aria-current={num === activePage ? 'page' : undefined}
                    aria-label={`Страница ${num} из ${pageCount}, ${kind}`}
                    onClick={() => scrollToPage(num)}
                  >
                    <span className="tt-inv-preview__thumb-sheet" aria-hidden>
                      <span className="tt-inv-preview__thumb-scale">
                        {num === 1
                          ? (
                              <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--letter">
                                <InvoiceCoverLetter model={displayModel}/>
                              </div>
                            )
                          : thumbTrIdx !== null && timeReportChunks[thumbTrIdx]
                            ? (
                                <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--timerpt">
                                  <InvoiceTimeReportPage
                                    model={displayModel}
                                    pack={resolvedTimeReportPack}
                                    pageNumber={2 + thumbTrIdx}
                                    detailRows={timeReportChunks[thumbTrIdx]}
                                    continuation={thumbTrIdx > 0}
                                    showDetailTotalRow={thumbTrIdx === timeReportChunks.length - 1}
                                    showSummarySection={thumbTrIdx === timeReportChunks.length - 1}
                                  />
                                </div>
                              )
                            : num === pageCount
                              ? (
                                  <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--invoice">
                                    <InvoiceLegalInvoicePage model={displayModel} session={session}/>
                                  </div>
                                )
                              : (
                                  <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--blank" aria-hidden/>
                                )}
                      </span>
                    </span>
                    <span className="tt-inv-preview__thumb-num">{num}</span>
                  </button>
                );
            })}
          </aside>

          <div className="tt-inv-preview__stage">
            <div className="tt-inv-preview__pdf-toolbar" role="toolbar" aria-label="Просмотр документа" title={pdfToolbarTip}>
              <div className="tt-inv-preview__pdf-toolbar-meta">
                <span className="tt-inv-preview__pdf-toolbar-doc" title={toolbarTitle}>{toolbarTitle}</span>
                {!coverModel ? <span className="tt-inv-preview__pdf-toolbar-status" role="status">Загрузка…</span> : null}
              </div>
              <div className="tt-inv-preview__pdf-toolbar-zoom" role="group" aria-label="Масштаб страницы документа">
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn"
                  onClick={zoomOut}
                  disabled={sheetZoomPct <= SHEET_ZOOM_MIN}
                  aria-label="Уменьшить масштаб страницы"
                  title="Уменьшить"
                >
                  −
                </button>
                <span className="tt-inv-preview__pdf-toolbar-zoom-val" aria-live="polite">{sheetZoomPct}%</span>
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn"
                  onClick={zoomIn}
                  disabled={sheetZoomPct >= SHEET_ZOOM_MAX}
                  aria-label="Увеличить масштаб страницы"
                  title="Увеличить"
                >
                  +
                </button>
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow"
                  onClick={zoomReset}
                  title="Масштаб 100%"
                >
                  100%
                </button>
                <button
                  type="button"
                  className="tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow"
                  onClick={zoomFitWidth}
                  title="Подогнать ширину листа к окну просмотра"
                >
                  По ширине
                </button>
              </div>
              <div className="tt-inv-preview__pdf-toolbar-pages" aria-live="polite">
                страница {activePage}&nbsp;/&nbsp;{pageCount}
              </div>
            </div>
            <div ref={sheetStackRef} className="tt-inv-preview__sheet-stack" aria-label="Документ, прокрутка колёсиком мыши или жестами">
              <div className="tt-inv-preview__pages" style={pagesZoomStyle}>
                <div
                  ref={(el) => {
                    pageRefs.current[0] = el;
                  }}
                  className="tt-inv-a4-page tt-inv-a4-page--cover"
                  aria-label={`Страница 1 из ${pageCount} — сопроводительное письмо`}
                >
                  <InvoiceCoverLetter model={displayModel}/>
                </div>
                {timeReportChunks.map((chunk, i) => (
                  <div
                    key={`tr-${i}`}
                    ref={(el) => {
                      pageRefs.current[1 + i] = el;
                    }}
                    className="tt-inv-a4-page tt-inv-a4-page--timerpt"
                    aria-label={`Страница ${2 + i} из ${pageCount} — time report${i > 0 ? ', продолжение' : ''}`}
                  >
                    <InvoiceTimeReportPage
                      model={displayModel}
                      pack={resolvedTimeReportPack}
                      pageNumber={2 + i}
                      detailRows={chunk}
                      continuation={i > 0}
                      showDetailTotalRow={i === timeReportChunks.length - 1}
                      showSummarySection={i === timeReportChunks.length - 1}
                    />
                  </div>
                ))}
                <div
                  ref={(el) => {
                    pageRefs.current[1 + timeReportChunks.length] = el;
                  }}
                  className="tt-inv-a4-page tt-inv-a4-page--invoice"
                  aria-label={`Страница ${pageCount} из ${pageCount} — счёт`}
                >
                  <InvoiceLegalInvoicePage model={displayModel} session={session}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>);
}
