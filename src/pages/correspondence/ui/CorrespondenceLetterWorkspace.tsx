import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import '@pages/time-tracking/ui/TimePageShell.css';
import '@pages/invoice-preview/ui/InvoicePreviewPage.css';
import { DOC_TYPE_META, type MockLetter } from './CorrespondencePage';
import {
    CorrespondenceLetterEditorProvider,
    CorrespondenceLetterEditorToolbar,
} from './CorrespondenceLetterBodyEditor';
import { CorrespondenceLetterSheet } from './CorrespondenceLetterSheet';
import './CorrespondenceLetterPreview.css';

const PAGE_COUNT = 1;
const INV_PREVIEW_PAGE_BASE_PX = 794;
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 250;
const SHEET_ZOOM_STEP = 10;

export type CorrespondenceLetterWorkspaceProps = {
    letter: MockLetter;
    coverModel: InvoiceCoverLetterModel;
    editable?: boolean;
    onCoverModelChange?: (patch: Partial<InvoiceCoverLetterModel>) => void;
    loading?: boolean;
    navbarTab: 'compose' | 'preview';
    navbarActions?: ReactNode;
    toolbarSubject?: ReactNode;
    statusNote?: string | null;
    statusTone?: 'pending' | 'rejected' | 'approved' | null;
    statusIcon?: ReactNode;
    onBack: () => void;
};

export function CorrespondenceLetterWorkspace({
    letter,
    coverModel,
    editable = false,
    onCoverModelChange,
    loading,
    navbarTab,
    navbarActions,
    toolbarSubject,
    statusNote,
    statusTone,
    statusIcon,
    onBack,
}: CorrespondenceLetterWorkspaceProps) {
    const typeMeta = DOC_TYPE_META[letter.docType];
    const sheetStackRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const [activePage, setActivePage] = useState(1);
    const [sheetZoomPct, setSheetZoomPct] = useState(100);

    const pagesZoomStyle = useMemo(() => ({
        zoom: `${sheetZoomPct}%`,
    } as CSSProperties), [sheetZoomPct]);

    const toolbarTitle = `${letter.registryNumber} · ${typeMeta.label}`;

    const scrollToPage = useCallback(() => {
        const root = sheetStackRef.current;
        const el = pageRef.current;
        if (!root || !el)
            return;
        const rootRect = root.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const nextTop = root.scrollTop + (elRect.top - rootRect.top) - 8;
        root.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
        setActivePage(1);
    }, []);

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

    const tabLabel = navbarTab === 'compose' ? 'Редактирование' : 'Предпросмотр';

    const letterSheetProps = {
        coverModel,
        registryNumber: letter.registryNumber,
        editable,
        onCoverModelChange,
    } as const;

    const bodyHtml = coverModel.introParagraphOverride ?? '';

    const stage = (
        <div className="tt-inv-preview__viewer" aria-label="Область просмотра документа">
            <aside className="tt-inv-preview__thumbs" aria-label="Миниатюры страниц">
                <div className="tt-inv-preview__thumbs-head">
                    <span className="tt-inv-preview__thumbs-title">Страницы</span>
                </div>
                <div className={`tt-inv-preview__thumb-wrap${activePage === 1 ? ' tt-inv-preview__thumb-wrap--active' : ''}`}>
                    <button
                        type="button"
                        className={`tt-inv-preview__thumb${activePage === 1 ? ' tt-inv-preview__thumb--active' : ''}`}
                        aria-current={activePage === 1 ? 'page' : undefined}
                        aria-label="Страница 1 из 1"
                        onClick={scrollToPage}
                    >
                        <span className="tt-inv-preview__thumb-sheet" aria-hidden>
                            <span className="tt-inv-preview__thumb-scale">
                                <div className="tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--letter">
                                    <CorrespondenceLetterSheet {...letterSheetProps} editable={false} />
                                </div>
                            </span>
                        </span>
                    </button>
                    <div className="tt-inv-preview__thumb-meta">
                        <span className="tt-inv-preview__thumb-num">1</span>
                    </div>
                </div>
            </aside>

            <div className="tt-inv-preview__stage">
                <div className="tt-inv-preview__pdf-toolbar" role="toolbar" aria-label="Просмотр документа">
                    <div className="tt-inv-preview__pdf-toolbar-meta">
                        <span className="tt-inv-preview__pdf-toolbar-doc" title={toolbarTitle}>{toolbarTitle}</span>
                        {toolbarSubject ?? (
                            <span className="tt-inv-preview__pdf-toolbar-export" title={letter.subject}>
                                {letter.subject}
                            </span>
                        )}
                        {statusNote && (
                            <span
                                className={`corr-doc-preview__status-note${statusTone ? ` corr-doc-preview__status-note--${statusTone}` : ''}`}
                                title={statusNote}
                            >
                                {statusIcon && (
                                    <span className="corr-doc-preview__status-icon" aria-hidden>{statusIcon}</span>
                                )}
                                {statusNote}
                            </span>
                        )}
                    </div>
                    <div className="tt-inv-preview__pdf-toolbar-zoom" role="group" aria-label="Масштаб страницы документа">
                        <button
                            type="button"
                            className="tt-inv-preview__pdf-toolbar-zoom-btn"
                            onClick={zoomOut}
                            disabled={sheetZoomPct <= SHEET_ZOOM_MIN}
                            aria-label="Уменьшить масштаб"
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
                            aria-label="Увеличить масштаб"
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
                        страница {activePage}&nbsp;/&nbsp;{PAGE_COUNT}
                    </div>
                </div>

                {editable ? (
                    <div className="corr-letter-editor__chrome-bar">
                        <CorrespondenceLetterEditorToolbar />
                    </div>
                ) : null}

                <div ref={sheetStackRef} className="tt-inv-preview__sheet-stack" aria-label="Документ">
                    <div className="tt-inv-preview__pages" style={pagesZoomStyle}>
                        <div
                            ref={pageRef}
                            className={`tt-inv-a4-page tt-inv-a4-page--cover corr-preview-a4${editable ? ' tt-inv-a4-page--editing' : ''}`}
                            aria-label={`Страница 1 из ${PAGE_COUNT} — ${typeMeta.label}${editable ? ', режим редактирования' : ''}`}
                        >
                            <CorrespondenceLetterSheet {...letterSheetProps} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="corr-doc-preview">
            <div className="tt-inv-preview">
                <nav className="time-page__navbar tt-inv-preview__navbar" aria-label="Корреспонденция">
                    <AppBackButton className="app-back-btn" onClick={onBack} hideLabelOnMobile />
                    <AppHomeLogo withSeparator />
                    <div className="time-page__navbar-sep" aria-hidden="true" />
                    <span className="time-page__navbar-title">Корреспонденция</span>
                    <div className="time-page__navbar-sep" aria-hidden="true" />
                    <div className="time-page__navbar-tabs" role="tablist" aria-label="Текущий раздел">
                        <span className="time-page__navbar-tab time-page__navbar-tab--active" role="tab" aria-selected="true" tabIndex={-1}>
                            {tabLabel}
                        </span>
                    </div>
                    <div className="time-page__navbar-spacer" />
                    {!loading && navbarActions && (
                        <div className="corr-doc-preview__actions" role="group" aria-label="Действия с документом">
                            {navbarActions}
                        </div>
                    )}
                    <div className="time-page__navbar-settings">
                        <AppPageSettings />
                    </div>
                </nav>

                <main className="tt-inv-preview__main">
                    {loading ? (
                        <div className="corr-doc-preview__loading" role="status">Загрузка документа…</div>
                    ) : editable ? (
                        <CorrespondenceLetterEditorProvider
                            value={bodyHtml}
                            editable
                            placeholder="Начните писать письмо — как в Word. Tab увеличивает отступ, Shift+Tab уменьшает."
                            onChange={(html) => onCoverModelChange?.({ introParagraphOverride: html || null })}
                        >
                            {stage}
                        </CorrespondenceLetterEditorProvider>
                    ) : (
                        stage
                    )}
                </main>
            </div>
        </div>
    );
}
