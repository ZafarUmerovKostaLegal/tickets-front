import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { getInvoiceCreateUrl, getInvoiceDetailUrl } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppToast } from '@shared/ui';
import { readInvoicePreviewSession } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { buildInvoiceCoverLetterModel } from '../lib/invoiceCoverLetterModel';
import { emptyInvoiceTimeReportPack, type InvoiceTimeReportDetailRow, type InvoiceTimeReportPack, type InvoiceTimeReportSummaryRow } from '../lib/invoiceTimeReportModel';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '../lib/invoicePreviewDownload';
import { packCurrencyCode } from '../lib/invoicePreviewPackShared';
import { splitDetailRowsForPagedTimeReport } from '../lib/invoiceTimeReportChunking';
import { invoicePreviewPageCount, type InvoiceLegalPageOverrides } from '../lib/invoiceLegalPageModel';
import { resolveInvoiceCoverLetterModel } from '../lib/resolveInvoiceCoverLetterModel';
import { resolveInvoiceTimeReportPack } from '../lib/resolveInvoiceTimeReportPack';
import { InvoiceCoverLetter } from './InvoiceCoverLetter';
import { InvoiceTimeReportPage } from './InvoiceTimeReportPage';
import { InvoiceLegalInvoicePage } from './InvoiceLegalInvoicePage';
import '@pages/time-tracking/ui/TimePageShell.css';
import './InvoicePreviewPage.css';

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

function allPagesSet(count: number): Set<number> {
    const s = new Set<number>();
    for (let i = 1; i <= count; i += 1)
        s.add(i);
    return s;
}

function globalDetailRowOffset(chunks: InvoiceTimeReportDetailRow[][], chunkIndex: number): number {
    let offset = 0;
    for (let c = 0; c < chunkIndex; c += 1)
        offset += chunks[c]?.length ?? 0;
    return offset;
}

export function InvoicePreviewPage() {
    const { pushToast } = useAppToast();
    const location = useLocation();
    const [downloadBusy, setDownloadBusy] = useState<'word' | 'pdf' | null>(null);
    const session = useMemo(() => readInvoicePreviewSession(), [location.key, location.pathname]);
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [legalOverrides, setLegalOverrides] = useState<InvoiceLegalPageOverrides>({});
    const [timeReportPack, setTimeReportPack] = useState<InvoiceTimeReportPack | null>(null);
    const [selectedPages, setSelectedPages] = useState<Set<number>>(() => new Set([1, 2, 3]));
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

    const patchCoverModel = useCallback((patch: Partial<InvoiceCoverLetterModel>) => {
        setCoverModel((prev) => ({
            ...(prev ?? fallbackCoverModel()),
            ...patch,
        }));
    }, []);

    const patchLegalOverrides = useCallback((patch: Partial<InvoiceLegalPageOverrides>) => {
        setLegalOverrides((prev) => ({ ...prev, ...patch }));
    }, []);

    const togglePageEdit = useCallback(() => {
        setEditMode((on) => !on);
    }, []);

    const editingPage = editMode ? activePage : null;

    const togglePageExport = useCallback((pageNum: number, checked: boolean) => {
        setSelectedPages((prev) => {
            const next = new Set(prev);
            if (checked)
                next.add(pageNum);
            else
                next.delete(pageNum);
            return next;
        });
    }, []);

    const selectAllPagesForExport = useCallback((pageCount: number) => {
        setSelectedPages(allPagesSet(pageCount));
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
        if (!session || coverModel == null)
            return;
        let cancel = false;
        void resolveInvoiceTimeReportPack(session, coverModel, {
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
    }, [session, coverModel != null, pushToast]);

    const timeReportFallback = useMemo(
        () => emptyInvoiceTimeReportPack(packCurrencyCode(displayModel)),
        [displayModel],
    );
    const resolvedTimeReportPack = timeReportPack ?? timeReportFallback;

    const timeReportChunks = useMemo(
        () => splitDetailRowsForPagedTimeReport(resolvedTimeReportPack.detailSlots),
        [resolvedTimeReportPack.detailSlots],
    );
    const pageCount = invoicePreviewPageCount(timeReportChunks.length);

    useEffect(() => {
        setSelectedPages((prev) => {
            const next = new Set<number>();
            for (let i = 1; i <= pageCount; i += 1) {
                if (prev.has(i))
                    next.add(i);
            }
            if (next.size === 0)
                return allPagesSet(pageCount);
            return next;
        });
        setActivePage((prev) => (prev > pageCount ? pageCount : prev));
    }, [pageCount]);

    useEffect(() => {
        setEditMode(false);
    }, [pageCount]);

    const patchDetailRowInChunk = useCallback((chunkIndex: number, rowIndex: number, field: keyof InvoiceTimeReportDetailRow, value: string) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const chunks = splitDetailRowsForPagedTimeReport(base.detailSlots);
            const globalIdx = globalDetailRowOffset(chunks, chunkIndex) + rowIndex;
            const nextSlots = [...base.detailSlots];
            while (nextSlots.length <= globalIdx)
                nextSlots.push({ date: '', initials: '', task: '', description: '', hours: '', amount: '' });
            nextSlots[globalIdx] = { ...nextSlots[globalIdx]!, [field]: value };
            return { ...base, detailSlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);

    const patchSummaryRow = useCallback((rowIndex: number, field: keyof InvoiceTimeReportSummaryRow, value: string) => {
        setTimeReportPack((prev) => {
            const base = prev ?? resolvedTimeReportPack;
            const nextSlots = [...base.summarySlots];
            while (nextSlots.length <= rowIndex)
                nextSlots.push({ initials: '', name: '', title: '', hours: '', hourlyRate: '', totalPrice: '' });
            nextSlots[rowIndex] = { ...nextSlots[rowIndex]!, [field]: value };
            return { ...base, summarySlots: nextSlots };
        });
    }, [resolvedTimeReportPack]);

    const patchTimeReportPack = useCallback((patch: Partial<Pick<InvoiceTimeReportPack, 'detailTotalHoursDisplay' | 'detailTotalAmountDisplay' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay'>>) => {
        setTimeReportPack((prev) => ({ ...(prev ?? resolvedTimeReportPack), ...patch }));
    }, [resolvedTimeReportPack]);

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
    }, [coverModel, pageCount, timeReportChunks.length]);

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
        ? getInvoiceDetailUrl(session.invoiceId)
        : getInvoiceCreateUrl({ resume: true });

    const exportInput = useMemo(() => ({
        model: coverModel ?? fallbackCoverModel(),
        session,
        timeReportPack: resolvedTimeReportPack,
        legalOverrides,
        selectedPageNumbers: [...selectedPages].sort((a, b) => a - b),
    }), [coverModel, session, resolvedTimeReportPack, legalOverrides, selectedPages]);

    const handleDownloadWord = useCallback(async () => {
        if (selectedPages.size === 0) {
            pushToast({ variant: 'warning', message: 'Выберите хотя бы одну страницу для экспорта' });
            return;
        }
        setDownloadBusy('word');
        try {
            const { buildInvoicePreviewDocxBlob } = await import('../lib/buildInvoicePreviewDocx');
            const blob = await buildInvoicePreviewDocxBlob(exportInput);
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
    }, [defaultFilename, exportInput, pushToast, selectedPages.size]);

    const handleDownloadPdf = useCallback(async () => {
        if (selectedPages.size === 0) {
            pushToast({ variant: 'warning', message: 'Выберите хотя бы одну страницу для экспорта' });
            return;
        }
        setDownloadBusy('pdf');
        try {
            const { buildInvoicePreviewPdfBlob } = await import('../lib/buildInvoicePreviewPdf');
            const blob = await buildInvoicePreviewPdfBlob(exportInput);
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
    }, [defaultFilename, exportInput, pushToast, selectedPages.size]);

    const toolbarTitle = subtitle ?? defaultFilename;
    const trRangeEnd = 1 + timeReportChunks.length;
    const isEditingActivePage = editMode;
    const exportSelectionLabel = selectedPages.size === pageCount
        ? `все ${pageCount}`
        : `${selectedPages.size} из ${pageCount}`;
    const pdfToolbarTip = `Лист 1 — сопроводительное письмо; листы 2–${trRangeEnd} — отчёт времени${timeReportChunks.length > 1 ? ' (продолжение при большом объёме)' : ''}; лист ${pageCount} — счёт (invoice). Отметьте страницы слева для экспорта. «Редактировать» действует на текущую страницу.`;

    const pageKindLabel = (num: number): string => {
        if (num === 1)
            return 'сопроводительное письмо';
        if (num === pageCount)
            return 'счёт';
        return 'time report';
    };

    return (<div className="tt-inv-preview">
      <nav className="time-page__navbar tt-inv-preview__navbar" aria-label="Предпросмотр счёта">
        <AppBackButton to={backHref} hideLabelOnMobile />
        <AppHomeLogo withSeparator />
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
          <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn" disabled={downloadBusy != null || selectedPages.size === 0} onClick={() => void handleDownloadPdf()}>
            {downloadBusy === 'pdf' ? 'Подготовка…' : 'Скачать PDF'}
          </button>
          <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-inv-preview__download-btn" disabled={downloadBusy != null || selectedPages.size === 0} onClick={() => void handleDownloadWord()}>
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
            <div className="tt-inv-preview__thumbs-head">
              <span className="tt-inv-preview__thumbs-title">Страницы</span>
              <button type="button" className="tt-inv-preview__thumbs-all" onClick={() => selectAllPagesForExport(pageCount)}>
                Все
              </button>
            </div>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => {
                const thumbTrIdx = num >= 2 && num < pageCount ? num - 2 : null;
                const exportOn = selectedPages.has(num);
                return (
                  <div key={num} className={`tt-inv-preview__thumb-wrap${num === activePage ? ' tt-inv-preview__thumb-wrap--active' : ''}${!exportOn ? ' tt-inv-preview__thumb-wrap--off' : ''}`}>
                    <button
                      type="button"
                      className={`tt-inv-preview__thumb${num === activePage ? ' tt-inv-preview__thumb--active' : ''}`}
                      aria-current={num === activePage ? 'page' : undefined}
                      aria-label={`Страница ${num} из ${pageCount}, ${pageKindLabel(num)}`}
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
                                      <InvoiceLegalInvoicePage model={displayModel} session={session} legalOverrides={legalOverrides}/>
                                    </div>
                                  )
                                : (
                                    <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--blank" aria-hidden/>
                                  )}
                        </span>
                      </span>
                    </button>
                    <div className="tt-inv-preview__thumb-meta">
                      <label className="tt-inv-preview__thumb-check" title={exportOn ? 'Исключить из экспорта' : 'Включить в экспорт'}>
                        <input
                          type="checkbox"
                          className="tt-inv-preview__thumb-check-input"
                          checked={exportOn}
                          onChange={(e) => togglePageExport(num, e.target.checked)}
                          aria-label={`Включить страницу ${num} в экспорт`}
                        />
                        <span className="tt-inv-preview__thumb-check-ui" aria-hidden="true" />
                      </label>
                      <span className="tt-inv-preview__thumb-num">{num}</span>
                    </div>
                  </div>
                );
            })}
          </aside>

          <div className="tt-inv-preview__stage">
            <div className="tt-inv-preview__pdf-toolbar" role="toolbar" aria-label="Просмотр документа" title={pdfToolbarTip}>
              <div className="tt-inv-preview__pdf-toolbar-meta">
                <span className="tt-inv-preview__pdf-toolbar-doc" title={toolbarTitle}>{toolbarTitle}</span>
                {!coverModel ? <span className="tt-inv-preview__pdf-toolbar-status" role="status">Загрузка…</span> : null}
                <span className="tt-inv-preview__pdf-toolbar-export" title="Страницы для PDF и Word">
                  Экспорт: {exportSelectionLabel}
                </span>
                <button
                  type="button"
                  className={`tt-inv-preview__pdf-toolbar-edit-btn${isEditingActivePage ? ' tt-inv-preview__pdf-toolbar-edit-btn--active' : ''}`}
                  onClick={togglePageEdit}
                  disabled={!coverModel}
                  aria-pressed={isEditingActivePage}
                  title={editMode ? 'Завершить редактирование' : `Редактировать страницу ${activePage}`}
                >
                  {editMode ? 'Готово' : 'Редактировать'}
                </button>
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
                  className={`tt-inv-a4-page tt-inv-a4-page--cover${editingPage === 1 ? ' tt-inv-a4-page--editing' : ''}${!selectedPages.has(1) ? ' tt-inv-a4-page--export-off' : ''}`}
                  aria-label={`Страница 1 из ${pageCount} — сопроводительное письмо${editingPage === 1 ? ', режим редактирования' : ''}`}
                >
                  <InvoiceCoverLetter
                    model={displayModel}
                    editable={editingPage === 1}
                    onChange={patchCoverModel}
                  />
                </div>
                {timeReportChunks.map((chunk, i) => {
                    const pageNum = 2 + i;
                    return (
                      <div
                        key={`tr-${i}`}
                        ref={(el) => {
                            pageRefs.current[1 + i] = el;
                        }}
                        className={`tt-inv-a4-page tt-inv-a4-page--timerpt${editingPage === pageNum ? ' tt-inv-a4-page--editing' : ''}${!selectedPages.has(pageNum) ? ' tt-inv-a4-page--export-off' : ''}`}
                        aria-label={`Страница ${pageNum} из ${pageCount} — time report${i > 0 ? ', продолжение' : ''}`}
                      >
                        <InvoiceTimeReportPage
                          model={displayModel}
                          pack={resolvedTimeReportPack}
                          pageNumber={pageNum}
                          detailRows={chunk}
                          continuation={i > 0}
                          showDetailTotalRow={i === timeReportChunks.length - 1}
                          showSummarySection={i === timeReportChunks.length - 1}
                          editable={editingPage === pageNum}
                          onPatchDetailRow={(rowIndex, field, value) => patchDetailRowInChunk(i, rowIndex, field, value)}
                          onPatchSummaryRow={patchSummaryRow}
                          onPatchPack={patchTimeReportPack}
                        />
                      </div>
                    );
                })}
                <div
                  ref={(el) => {
                    pageRefs.current[1 + timeReportChunks.length] = el;
                  }}
                  className={`tt-inv-a4-page tt-inv-a4-page--invoice${editingPage === pageCount ? ' tt-inv-a4-page--editing' : ''}${!selectedPages.has(pageCount) ? ' tt-inv-a4-page--export-off' : ''}`}
                  aria-label={`Страница ${pageCount} из ${pageCount} — счёт`}
                >
                  <InvoiceLegalInvoicePage
                    model={displayModel}
                    session={session}
                    editable={editingPage === pageCount}
                    legalOverrides={legalOverrides}
                    onChangeLegalOverrides={patchLegalOverrides}
                    onChangeModel={patchCoverModel}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>);
}
