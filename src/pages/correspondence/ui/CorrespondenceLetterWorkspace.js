import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import '@pages/time-tracking/ui/TimePageShell.css';
import '@pages/invoice-preview/ui/InvoicePreviewPage.css';
import { DOC_TYPE_META } from './CorrespondencePage';
import { CorrespondenceLetterEditorProvider, CorrespondenceLetterEditorToolbar, } from './CorrespondenceLetterBodyEditor';
import { CorrespondenceLetterSheet } from './CorrespondenceLetterSheet';
import { useCorrespondenceDownloadQr } from '../lib/useCorrespondenceDownloadQr';
import './CorrespondenceLetterPreview.css';
const PAGE_COUNT = 1;
const INV_PREVIEW_PAGE_BASE_PX = 794;
const SHEET_ZOOM_MIN = 50;
const SHEET_ZOOM_MAX = 250;
const SHEET_ZOOM_STEP = 10;
export function CorrespondenceLetterWorkspace({ letter, coverModel, editable = false, onCoverModelChange, loading, navbarTab, navbarActions, toolbarSubject, statusNote, statusTone, statusIcon, onBack, downloadDocumentId, }) {
    const typeMeta = DOC_TYPE_META[letter.docType];
    const sheetStackRef = useRef(null);
    const pageRef = useRef(null);
    const [activePage, setActivePage] = useState(1);
    const [sheetZoomPct, setSheetZoomPct] = useState(100);
    const { url: downloadQrUrl } = useCorrespondenceDownloadQr(downloadDocumentId, Boolean(downloadDocumentId));
    const pagesZoomStyle = useMemo(() => {
        // CSS `zoom` breaks contentEditable (Enter / caret) in Chromium — lock 100% while editing.
        const pct = editable ? 100 : sheetZoomPct;
        return { zoom: `${pct}%` };
    }, [editable, sheetZoomPct]);
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
        downloadQrUrl,
    };
    const bodyHtml = coverModel.introParagraphOverride ?? '';
    const stage = (_jsxs("div", { className: "tt-inv-preview__viewer", "aria-label": "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [_jsxs("aside", { className: "tt-inv-preview__thumbs", "aria-label": "\u041C\u0438\u043D\u0438\u0430\u0442\u044E\u0440\u044B \u0441\u0442\u0440\u0430\u043D\u0438\u0446", children: [_jsx("div", { className: "tt-inv-preview__thumbs-head", children: _jsx("span", { className: "tt-inv-preview__thumbs-title", children: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B" }) }), _jsxs("div", { className: `tt-inv-preview__thumb-wrap${activePage === 1 ? ' tt-inv-preview__thumb-wrap--active' : ''}`, children: [_jsx("button", { type: "button", className: `tt-inv-preview__thumb${activePage === 1 ? ' tt-inv-preview__thumb--active' : ''}`, "aria-current": activePage === 1 ? 'page' : undefined, "aria-label": "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 1 \u0438\u0437 1", onClick: scrollToPage, children: _jsx("span", { className: "tt-inv-preview__thumb-sheet", "aria-hidden": true, children: _jsx("span", { className: "tt-inv-preview__thumb-scale", children: _jsx("div", { className: "tt-inv-preview__thumb-doc tt-inv-preview__thumb-doc--letter", children: _jsx(CorrespondenceLetterSheet, { ...letterSheetProps, editable: false }) }) }) }) }), _jsx("div", { className: "tt-inv-preview__thumb-meta", children: _jsx("span", { className: "tt-inv-preview__thumb-num", children: "1" }) })] })] }), _jsxs("div", { className: "tt-inv-preview__stage", children: [_jsxs("div", { className: "tt-inv-preview__pdf-toolbar", role: "toolbar", "aria-label": "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [_jsxs("div", { className: "tt-inv-preview__pdf-toolbar-meta", children: [_jsx("span", { className: "tt-inv-preview__pdf-toolbar-doc", title: toolbarTitle, children: toolbarTitle }), toolbarSubject ?? (_jsx("span", { className: "tt-inv-preview__pdf-toolbar-export", title: letter.subject, children: letter.subject })), statusNote && (_jsxs("span", { className: `corr-doc-preview__status-note${statusTone ? ` corr-doc-preview__status-note--${statusTone}` : ''}`, title: statusNote, children: [statusIcon && (_jsx("span", { className: "corr-doc-preview__status-icon", "aria-hidden": true, children: statusIcon })), statusNote] }))] }), _jsxs("div", { className: "tt-inv-preview__pdf-toolbar-zoom", role: "group", "aria-label": "\u041C\u0430\u0441\u0448\u0442\u0430\u0431 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [_jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn", onClick: zoomOut, disabled: editable || sheetZoomPct <= SHEET_ZOOM_MIN, "aria-label": "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431", title: editable ? 'Масштаб недоступен при редактировании' : 'Уменьшить', children: "\u2212" }), _jsxs("span", { className: "tt-inv-preview__pdf-toolbar-zoom-val", "aria-live": "polite", children: [editable ? 100 : sheetZoomPct, "%"] }), _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn", onClick: zoomIn, disabled: editable || sheetZoomPct >= SHEET_ZOOM_MAX, "aria-label": "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431", title: editable ? 'Масштаб недоступен при редактировании' : 'Увеличить', children: "+" }), _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow", onClick: zoomReset, disabled: editable, title: editable ? 'Масштаб недоступен при редактировании' : 'Масштаб 100%', children: "100%" }), _jsx("button", { type: "button", className: "tt-inv-preview__pdf-toolbar-zoom-btn tt-inv-preview__pdf-toolbar-zoom-btn--narrow", onClick: zoomFitWidth, disabled: editable, title: editable ? 'Масштаб недоступен при редактировании' : 'Подогнать ширину листа к окну просмотра', children: "\u041F\u043E \u0448\u0438\u0440\u0438\u043D\u0435" })] }), _jsxs("div", { className: "tt-inv-preview__pdf-toolbar-pages", "aria-live": "polite", children: ["\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 ", activePage, "\u00A0/\u00A0", PAGE_COUNT] })] }), editable ? (_jsx("div", { className: "corr-letter-editor__chrome-bar", children: _jsx(CorrespondenceLetterEditorToolbar, {}) })) : null, _jsx("div", { ref: sheetStackRef, className: "tt-inv-preview__sheet-stack", "aria-label": "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442", children: _jsx("div", { className: "tt-inv-preview__pages", style: pagesZoomStyle, children: _jsx("div", { ref: pageRef, className: `tt-inv-a4-page tt-inv-a4-page--cover corr-preview-a4${editable ? ' tt-inv-a4-page--editing' : ''}`, "aria-label": `Страница 1 из ${PAGE_COUNT} — ${typeMeta.label}${editable ? ', режим редактирования' : ''}`, children: _jsx(CorrespondenceLetterSheet, { ...letterSheetProps }) }) }) })] })] }));
    return (_jsx("div", { className: "corr-doc-preview", children: _jsxs("div", { className: "tt-inv-preview", children: [_jsxs("nav", { className: "time-page__navbar tt-inv-preview__navbar", "aria-label": "\u041A\u043E\u0440\u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0446\u0438\u044F", children: [_jsx(AppBackButton, { className: "app-back-btn", onClick: onBack, hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("span", { className: "time-page__navbar-title", children: "\u041A\u043E\u0440\u0440\u0435\u0441\u043F\u043E\u043D\u0434\u0435\u043D\u0446\u0438\u044F" }), _jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("div", { className: "time-page__navbar-tabs", role: "tablist", "aria-label": "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0440\u0430\u0437\u0434\u0435\u043B", children: _jsx("span", { className: "time-page__navbar-tab time-page__navbar-tab--active", role: "tab", "aria-selected": "true", tabIndex: -1, children: tabLabel }) }), _jsx("div", { className: "time-page__navbar-spacer" }), !loading && navbarActions && (_jsx("div", { className: "corr-doc-preview__actions", role: "group", "aria-label": "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u043C", children: navbarActions })), _jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) })] }), _jsx("main", { className: "tt-inv-preview__main", children: loading ? (_jsx("div", { className: "corr-doc-preview__loading", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u2026" })) : editable ? (_jsx(CorrespondenceLetterEditorProvider, { value: bodyHtml, editable: true, placeholder: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u043F\u0438\u0441\u0430\u0442\u044C \u043F\u0438\u0441\u044C\u043C\u043E. Enter \u2014 \u043D\u043E\u0432\u044B\u0439 \u0430\u0431\u0437\u0430\u0446, Shift+Enter \u2014 \u043F\u0435\u0440\u0435\u043D\u043E\u0441 \u0441\u0442\u0440\u043E\u043A\u0438.", onChange: (html) => onCoverModelChange?.({ introParagraphOverride: html || null }), children: stage })) : (stage) })] }) }));
}
