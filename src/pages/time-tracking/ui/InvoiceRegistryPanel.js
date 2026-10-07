import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimeTrackingForms.css';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getInvoiceDetailUrl } from '@shared/config';
import { formatAdvanceFeeLines, formatRegistryAmountCell, SYSTEM_INVOICE_REGISTRY_STATUSES, collectRegistryStatusOptions, filterInvoiceRegistryRows, getInvoiceRegistrySheet, isInvoiceRegistryMoneyColumnKey, registryStatusToneClass, loadInvoiceRegistryRows, } from '@entities/time-tracking/model/invoiceRegistry';
import { cancelInvoice, markInvoiceViewed, sendInvoice, unsendInvoice, } from '@entities/time-tracking/api/domains/invoices';
import { createInvoiceRegistryRow2026, getInvoiceRegistrySheet as getInvoiceRegistrySheetApi, getInvoiceRegistryYears, MANUAL_2026_SEED_REVISION, patchInvoiceRegistryRow2026, replaceInvoiceRegistryArchiveSheet, replaceInvoiceRegistryRows2026, } from '@entities/time-tracking/api/domains/invoiceRegistry';
import { downloadExistingInvoicePdf } from '../lib/invoicePageShared';
import { useI18n } from '@shared/i18n';
import { DatePicker } from '@shared/ui/DatePicker';
import { showToast } from '@shared/ui/app-toast';
import './InvoiceRegistryPanel.css';
function RegistryStatusDropdown({ value, ariaLabel, readOnly, choices, allowCustom = true, onChange, }) {
    const uid = useId();
    const listId = `${uid}-list`;
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const menuRef = useRef(null);
    const [menuPos, setMenuPos] = useState(null);
    const label = value || '—';
    const [draft, setDraft] = useState(value);
    const options = useMemo(() => {
        const values = collectRegistryStatusOptions([value, ...choices]);
        return values.map((s) => ({ value: s, label: s }));
    }, [value, choices]);
    const updatePos = useCallback(() => {
        const btn = btnRef.current;
        if (!btn)
            return;
        const r = btn.getBoundingClientRect();
        const width = Math.max(r.width, 280);
        const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
        const below = r.bottom + 4;
        const menuH = Math.min(280, 44 + options.length * 36);
        const top = below + menuH > window.innerHeight - 8
            ? Math.max(8, r.top - menuH - 4)
            : below;
        setMenuPos({ top, left, width });
    }, [options.length]);
    useLayoutEffect(() => {
        if (!open)
            return;
        updatePos();
    }, [open, updatePos]);
    useEffect(() => {
        if (!open)
            return;
        const onScroll = () => updatePos();
        const onKey = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        const onPointer = (e) => {
            const t = e.target;
            if (btnRef.current?.contains(t) || menuRef.current?.contains(t))
                return;
            setOpen(false);
        };
        window.addEventListener('resize', onScroll);
        window.addEventListener('scroll', onScroll, true);
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer, true);
        return () => {
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('scroll', onScroll, true);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer, true);
        };
    }, [open, updatePos]);
    return (_jsxs("div", { className: "tt-inv-reg-status", children: [_jsxs("button", { ref: btnRef, type: "button", className: `tt-inv-reg-status__btn ${registryStatusToneClass(value)}${open ? ' tt-inv-reg-status__btn--open' : ''}`, "aria-label": ariaLabel, "aria-expanded": open, "aria-haspopup": "listbox", "aria-controls": open ? listId : undefined, disabled: readOnly, title: value || undefined, onClick: () => {
                    if (readOnly)
                        return;
                    setDraft(value);
                    setOpen((v) => !v);
                }, children: [_jsx("span", { className: "tt-inv-reg-status__label", children: label }), _jsx("span", { className: "tt-inv-reg-status__chev", "aria-hidden": true, children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] }), open && !readOnly && menuPos && createPortal(_jsxs("div", { ref: menuRef, id: listId, className: "tt-inv-reg-status__menu", role: "listbox", style: { top: menuPos.top, left: menuPos.left, width: menuPos.width }, children: [options.map((opt) => {
                        const selected = opt.value === value;
                        return (_jsxs("button", { type: "button", role: "option", "aria-selected": selected, className: `tt-inv-reg-status__opt${selected ? ' tt-inv-reg-status__opt--active' : ''}`, onClick: () => {
                                onChange(opt.value);
                                setOpen(false);
                            }, children: [_jsx("span", { className: `tt-inv-reg-status__dot ${registryStatusToneClass(opt.value)}`, "aria-hidden": true }), opt.label] }, opt.value || '__empty'));
                    }), allowCustom && (_jsx("form", { className: "tt-inv-reg-status__custom", onSubmit: (e) => {
                            e.preventDefault();
                            onChange(draft.trim());
                            setOpen(false);
                        }, children: _jsx("input", { className: "tt-inv-reg-status__custom-input", value: draft, "aria-label": ariaLabel, onChange: (e) => setDraft(e.target.value) }) }))] }), document.body)] }));
}
async function applySystemRegistryStatus(invoiceId, label) {
    if (label === 'Черновик')
        await unsendInvoice(invoiceId);
    else if (label === 'Отправлен')
        await sendInvoice(invoiceId);
    else if (label === 'Просмотрен')
        await markInvoiceViewed(invoiceId);
    else if (label === 'Отменён')
        await cancelInvoice(invoiceId);
    else
        throw new Error('Этот статус для системного счёта задаётся оплатой или сроком, а не вручную.');
}
function systemInvoiceId(row) {
    const explicit = String(row.invoiceId ?? '').trim();
    if (explicit)
        return explicit;
    return row.id.startsWith('sys-') ? row.id.slice(4) : '';
}
function RegistryPdfButton({ invoiceId, ariaLabel }) {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    return (_jsx("button", { type: "button", className: "tt-inv-reg__pdf", disabled: !invoiceId || busy, "aria-label": ariaLabel, onClick: () => {
            if (!invoiceId || busy)
                return;
            setBusy(true);
            void downloadExistingInvoicePdf(invoiceId)
                .catch(() => {
                showToast({
                    message: t('timeTrackingPage.invoices.errors.pdfFailed'),
                    variant: 'error',
                });
            })
                .finally(() => setBusy(false));
        }, children: "PDF" }));
}
function IcoFullscreen({ exit }) {
    if (exit) {
        return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M8 3v3a2 2 0 0 1-2 2H3" }), _jsx("path", { d: "M21 8h-3a2 2 0 0 1-2-2V3" }), _jsx("path", { d: "M3 16h3a2 2 0 0 1 2 2v3" }), _jsx("path", { d: "M16 21v-3a2 2 0 0 1 2-2h3" })] }));
    }
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }), _jsx("path", { d: "M21 8V5a2 2 0 0 0-2-2h-3" }), _jsx("path", { d: "M3 16v3a2 2 0 0 0 2 2h3" }), _jsx("path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" })] }));
}
function emptyRow(year, keys, index) {
    const row = { id: `${year}-new-${Date.now()}-${index}` };
    for (const k of keys)
        row[k] = k === 'statusNote' ? 'Черновик' : '';
    return row;
}
function AdvanceFeeReadout({ value }) {
    const lines = formatAdvanceFeeLines(value);
    if (lines.length === 0)
        return _jsx("span", { className: "tt-inv-reg__cell-text", children: '\u00a0' });
    return (_jsx("ul", { className: "tt-inv-reg-fee", children: lines.map((line, index) => ('partner' in line ? (_jsxs("li", { className: "tt-inv-reg-fee__row", children: [_jsx("span", { className: "tt-inv-reg-fee__code", children: line.partner }), _jsx("span", { className: "tt-inv-reg-fee__amounts", children: line.amounts.map((amount, amountIndex) => (_jsx("span", { className: "tt-inv-reg-fee__amt", children: amount }, `${amount}-${amountIndex}`))) })] }, `${line.partner}-${index}`)) : (_jsx("li", { className: "tt-inv-reg-fee__plain", children: line.text }, `text-${index}`)))) }));
}
function RegistryEditableCell({ value, ariaLabel, wide, columnKey, editor = 'text', money = false, readOnly, active, invoiceId = '', statusChoices, allowCustomStatus = true, onActivate, onChange, onBlurCommit, }) {
    const ref = useRef(null);
    const isMoney = money && editor === 'text';
    useEffect(() => {
        if (active && editor === 'text' && ref.current) {
            ref.current.focus();
            if ('select' in ref.current)
                ref.current.select();
        }
    }, [active, editor]);
    if (editor === 'pdf') {
        return (_jsx("td", { className: "tt-inv-reg__td tt-inv-reg__td--pdf", children: _jsx(RegistryPdfButton, { invoiceId: invoiceId, ariaLabel: ariaLabel }) }));
    }
    if (editor === 'status') {
        return (_jsx("td", { className: "tt-inv-reg__td tt-inv-reg__td--status", children: _jsx(RegistryStatusDropdown, { value: value, ariaLabel: ariaLabel, readOnly: readOnly, choices: statusChoices, allowCustom: allowCustomStatus, onChange: onChange }) }));
    }
    if (!active) {
        const display = isMoney ? formatRegistryAmountCell(value) : value;
        const fee = columnKey === 'advanceFee';
        return (_jsx("td", { className: `tt-inv-reg__td${wide ? ' tt-inv-reg__td--wide' : ''}${isMoney ? ' tt-inv-reg__td--money' : ''}${fee ? ' tt-inv-reg__td--fee' : ''}${columnKey === 'seqNo' ? ' tt-inv-reg__td--pin' : ''}`, onClick: onActivate, onFocus: onActivate, tabIndex: 0, role: "gridcell", "aria-label": ariaLabel, title: fee ? value : (display || undefined), children: fee ? _jsx(AdvanceFeeReadout, { value: value }) : _jsx("span", { className: "tt-inv-reg__cell-text", children: display || '\u00a0' }) }));
    }
    const multiline = !isMoney && (wide || value.includes('\n') || value.length > 48);
    if (multiline) {
        return (_jsx("td", { className: `tt-inv-reg__td tt-inv-reg__td--editing${wide ? ' tt-inv-reg__td--wide' : ''}`, children: _jsx("textarea", { ref: (el) => { ref.current = el; }, className: "tt-inv-reg__input tt-inv-reg__input--area", value: value, "aria-label": ariaLabel, rows: Math.min(6, Math.max(2, value.split('\n').length + 1)), onChange: (e) => onChange(e.target.value), onBlur: () => {
                    if (isMoney) {
                        const next = formatRegistryAmountCell(value);
                        if (next !== value)
                            onChange(next);
                    }
                    onBlurCommit();
                }, onKeyDown: (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        e.target.blur();
                    }
                } }) }));
    }
    return (_jsx("td", { className: `tt-inv-reg__td tt-inv-reg__td--editing${isMoney ? ' tt-inv-reg__td--money' : ''}`, children: _jsx("input", { ref: (el) => { ref.current = el; }, type: "text", inputMode: isMoney ? 'decimal' : undefined, className: "tt-inv-reg__input", value: value, "aria-label": ariaLabel, onChange: (e) => onChange(e.target.value), onBlur: (e) => {
                if (isMoney) {
                    const next = formatRegistryAmountCell(e.currentTarget.value);
                    if (next !== value)
                        onChange(next);
                }
                onBlurCommit();
            }, onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    e.target.blur();
                }
            } }) }));
}
function RegistryMonthMenu({ labels, selected, allLabel, ariaLabel, onToggle, }) {
    const uid = useId();
    const listId = `${uid}-months`;
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const menuRef = useRef(null);
    const [menuPos, setMenuPos] = useState(null);
    const buttonLabel = selected.size === 0
        ? allLabel
        : selected.size === 1
            ? labels[[...selected][0] - 1] ?? allLabel
            : `${allLabel} (${selected.size})`;
    const updatePos = useCallback(() => {
        const btn = btnRef.current;
        if (!btn)
            return;
        const r = btn.getBoundingClientRect();
        const width = Math.max(r.width, 220);
        const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
        const menuH = 320;
        const below = r.bottom + 4;
        const top = below + menuH > window.innerHeight - 8
            ? Math.max(8, r.top - menuH - 4)
            : below;
        setMenuPos({ top, left, width });
    }, []);
    useLayoutEffect(() => {
        if (!open)
            return;
        updatePos();
    }, [open, updatePos]);
    useEffect(() => {
        if (!open)
            return;
        const onScroll = () => updatePos();
        const onKey = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        const onPointer = (e) => {
            const t = e.target;
            if (btnRef.current?.contains(t) || menuRef.current?.contains(t))
                return;
            setOpen(false);
        };
        window.addEventListener('resize', onScroll);
        window.addEventListener('scroll', onScroll, true);
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer, true);
        return () => {
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('scroll', onScroll, true);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer, true);
        };
    }, [open, updatePos]);
    return (_jsxs(_Fragment, { children: [_jsxs("button", { ref: btnRef, type: "button", className: `tt-inv-reg__filter tt-inv-reg__month-btn${open ? ' tt-inv-reg__month-btn--open' : ''}`, "aria-label": ariaLabel, "aria-expanded": open, "aria-haspopup": "listbox", "aria-controls": open ? listId : undefined, onClick: () => setOpen((v) => !v), children: [_jsx("span", { className: "tt-inv-reg__month-btn-label", children: buttonLabel }), _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), open && menuPos && createPortal(_jsx("div", { ref: menuRef, id: listId, className: "tt-inv-reg__month-menu", role: "listbox", "aria-multiselectable": true, style: { top: menuPos.top, left: menuPos.left, width: menuPos.width }, children: labels.map((label, index) => {
                    const month = index + 1;
                    const on = selected.has(month);
                    return (_jsxs("button", { type: "button", role: "option", "aria-selected": on, className: `tt-inv-reg__month-opt${on ? ' tt-inv-reg__month-opt--on' : ''}`, onClick: () => onToggle(month), children: [_jsx("span", { className: "tt-inv-reg__month-check", "aria-hidden": true, children: on ? '✓' : '' }), label] }, label));
                }) }), document.body)] }));
}
const REGISTRY_YEAR_KEY = 'tt-inv-reg-year';
const REGISTRY_YEARS = new Set([
    '2026', '2026-system', '2025', '2024', '2023', '2022', '2021', '2020', 'checklist',
]);
function readRegistryYear() {
    try {
        const saved = window.sessionStorage.getItem(REGISTRY_YEAR_KEY);
        if (saved && REGISTRY_YEARS.has(saved))
            return saved;
    }
    catch {
        /* private mode */
    }
    return '2026';
}
export function InvoiceRegistryPanel({ readOnly = false, variant = 'default', }) {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const accountingEmbed = variant === 'accounting';
    const openInvoiceDetail = useCallback((invoiceId) => {
        const id = invoiceId.trim();
        if (!id)
            return;
        navigate(getInvoiceDetailUrl(id, accountingEmbed ? { variant: 'accounting' } : undefined));
    }, [accountingEmbed, navigate]);
    const [year, setYear] = useState(readRegistryYear);
    const [rows, setRows] = useState([]);
    const [years, setYears] = useState([]);
    const [sheetMode, setSheetMode] = useState('active');
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [focus, setFocus] = useState(null);
    const [search, setSearch] = useState('');
    const [partners, setPartners] = useState(() => new Set());
    const [numberQuery, setNumberQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [months, setMonths] = useState(() => new Set());
    const [fullscreen, setFullscreen] = useState(false);
    const sheet = useMemo(() => getInvoiceRegistrySheet(year), [year]);
    const columns = sheet.columns;
    const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
    const canEditYear = !readOnly && year !== '2026-system' && year !== 'checklist';
    const seededYearsRef = useRef(new Set());
    const refreshYears = useCallback(() => {
        void getInvoiceRegistryYears()
            .then((payload) => setYears(payload.years))
            .catch(() => {
            showToast({
                message: t('timeTrackingPage.invoices.registry.loadFailed'),
                variant: 'error',
            });
        });
    }, [t]);
    useEffect(() => {
        refreshYears();
    }, [refreshYears]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFocus(null);
        setSearch('');
        setPartners(new Set());
        setNumberQuery('');
        setDateFrom('');
        setDateTo('');
        setMonths(new Set());
        const loadSheet = async () => {
            try {
                let loadedSheet = await getInvoiceRegistrySheetApi(year);
                if (cancelled)
                    return;
                const apiRows = Array.isArray(loadedSheet.rows) ? loadedSheet.rows : [];
                const needsSeed = year !== '2026-system'
                    && apiRows.length === 0
                    && !seededYearsRef.current.has(year)
                    && !readOnly;
                if (year === '2026' && !readOnly) {
                    const catalog = await getInvoiceRegistryYears();
                    if (cancelled)
                        return;
                    setYears(catalog.years);
                    if (catalog.seedRevision2026 !== null && catalog.seedRevision2026 !== MANUAL_2026_SEED_REVISION) {
                        const { rows: seedRows } = await loadInvoiceRegistryRows('2026');
                        if (cancelled)
                            return;
                        await replaceInvoiceRegistryRows2026(seedRows, {
                            force: seedRows.length === 0,
                            seedRevision: MANUAL_2026_SEED_REVISION,
                        });
                        loadedSheet = await getInvoiceRegistrySheetApi('2026');
                        if (cancelled)
                            return;
                        refreshYears();
                    }
                }
                if (needsSeed) {
                    seededYearsRef.current.add(year);
                    const { rows: seedRows } = await loadInvoiceRegistryRows(year);
                    if (cancelled)
                        return;
                    if (seedRows.length > 0) {
                        if (year === '2026') {
                            await replaceInvoiceRegistryRows2026(seedRows, { seedRevision: MANUAL_2026_SEED_REVISION });
                        }
                        else {
                            await replaceInvoiceRegistryArchiveSheet(year, seedRows);
                        }
                        loadedSheet = await getInvoiceRegistrySheetApi(year);
                        if (cancelled)
                            return;
                        showToast({
                            message: t('timeTrackingPage.invoices.registry.seedImported')
                                .replace('{count}', String(seedRows.length))
                                .replace('{year}', year === 'checklist' ? 'check list' : year),
                            variant: 'info',
                        });
                        refreshYears();
                    }
                }
                if (cancelled)
                    return;
                setRows(Array.isArray(loadedSheet.rows) ? loadedSheet.rows : []);
                setSheetMode(loadedSheet.mode === 'archive' || loadedSheet.mode === 'system' ? loadedSheet.mode : 'active');
                setDirty(false);
            }
            catch {
                if (cancelled)
                    return;
                setRows([]);
                showToast({
                    message: t('timeTrackingPage.invoices.registry.loadFailed'),
                    variant: 'error',
                });
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void loadSheet();
        return () => {
            cancelled = true;
        };
    }, [year, t, readOnly, refreshYears]);
    const statusChoices = useMemo(() => {
        if (year === '2026-system')
            return [...SYSTEM_INVOICE_REGISTRY_STATUSES];
        return collectRegistryStatusOptions(rows.map((row) => String(row.statusNote ?? '')));
    }, [rows, year]);
    const archiveSaveTimer = useRef(null);
    const pendingArchiveSave = useRef(null);
    const persistArchiveRows = useCallback((next, sheetYear) => {
        if (sheetYear === '2026' || sheetYear === '2026-system' || sheetYear === 'checklist')
            return;
        pendingArchiveSave.current = { year: sheetYear, rows: next };
        if (archiveSaveTimer.current !== null)
            window.clearTimeout(archiveSaveTimer.current);
        archiveSaveTimer.current = window.setTimeout(() => {
            archiveSaveTimer.current = null;
            pendingArchiveSave.current = null;
            void replaceInvoiceRegistryArchiveSheet(sheetYear, next).catch(() => {
                showToast({
                    message: t('timeTrackingPage.invoices.registry.loadFailed'),
                    variant: 'error',
                });
            });
        }, 400);
    }, [t]);
    useEffect(() => () => {
        if (archiveSaveTimer.current !== null)
            window.clearTimeout(archiveSaveTimer.current);
        const pending = pendingArchiveSave.current;
        pendingArchiveSave.current = null;
        if (!pending || pending.year === '2026' || pending.year === '2026-system' || pending.year === 'checklist')
            return;
        void replaceInvoiceRegistryArchiveSheet(pending.year, pending.rows);
    }, [year]);
    const partnerOptions = useMemo(() => {
        const codes = new Set();
        for (const row of rows) {
            const code = String(row.partner ?? '').trim();
            if (code)
                codes.add(code);
        }
        return [...codes].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [rows]);
    const monthLabels = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'ru', { month: 'long' });
        return Array.from({ length: 12 }, (_, index) => {
            const raw = fmt.format(new Date(2026, index, 1));
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        });
    }, [locale]);
    const filtersActive = partners.size > 0 || numberQuery.trim() !== '' || dateFrom !== '' || dateTo !== '' || months.size > 0;
    const filteredRows = useMemo(() => filterInvoiceRegistryRows(rows, {
        search,
        searchKeys: columnKeys,
        partners,
        numberQuery,
        dateFrom,
        dateTo,
        months,
    }), [rows, search, columnKeys, partners, numberQuery, dateFrom, dateTo, months]);
    const togglePartner = (code) => {
        setPartners((prev) => {
            const next = new Set(prev);
            if (next.has(code))
                next.delete(code);
            else
                next.add(code);
            return next;
        });
    };
    const toggleMonth = (month) => {
        setMonths((prev) => {
            const next = new Set(prev);
            if (next.has(month))
                next.delete(month);
            else
                next.add(month);
            return next;
        });
    };
    const clearFilters = () => {
        setPartners(new Set());
        setNumberQuery('');
        setDateFrom('');
        setDateTo('');
        setMonths(new Set());
    };
    const patchCell = useCallback((rowId, key, value) => {
        if (year === '2026-system') {
            if (readOnly || key !== 'statusNote')
                return;
            const row = rows.find((item) => item.id === rowId);
            const invoiceId = row ? systemInvoiceId(row) : '';
            const previous = String(row?.statusNote ?? '');
            if (!invoiceId || value === previous)
                return;
            setRows((prev) => prev.map((item) => (item.id === rowId ? { ...item, statusNote: value } : item)));
            void applySystemRegistryStatus(invoiceId, value)
                .catch((error) => {
                setRows((prev) => prev.map((item) => (item.id === rowId ? { ...item, statusNote: previous } : item)));
                showToast({
                    message: error instanceof Error && error.message
                        ? error.message
                        : t('timeTrackingPage.invoices.registry.loadFailed'),
                    variant: 'error',
                });
            });
            return;
        }
        if (!canEditYear)
            return;
        setRows((prev) => {
            const next = prev.map((r) => (r.id === rowId ? { ...r, [key]: value } : r));
            if (year !== '2026')
                persistArchiveRows(next, year);
            return next;
        });
        setDirty(true);
        if (year === '2026') {
            void patchInvoiceRegistryRow2026(rowId, { [key]: value })
                .catch(() => {
                showToast({
                    message: t('timeTrackingPage.invoices.registry.loadFailed'),
                    variant: 'error',
                });
            });
        }
    }, [canEditYear, persistArchiveRows, readOnly, rows, t, year]);
    const addRow = useCallback(() => {
        if (!canEditYear)
            return;
        if (year !== '2026') {
            setRows((prev) => {
                const next = [...prev, emptyRow(year, columnKeys, prev.length + 1)];
                persistArchiveRows(next, year);
                return next;
            });
            setDirty(true);
            return;
        }
        setRows((prev) => {
            const next = [...prev, emptyRow(year, columnKeys, prev.length + 1)];
            return next;
        });
        void createInvoiceRegistryRow2026({
            seqNo: '',
            billedTo: '',
            currency: 'USD',
            amount: '',
            details: '',
            partner: '',
            issueDate: '',
            dueOrPayment: '',
            clientNumber: '',
            statusNote: 'Черновик',
            advanceFee: '',
            balance: '',
        }).then((created) => {
            setRows((prev) => [...prev.filter((r) => !r.id.includes('-new-')), created]);
            setDirty(true);
            refreshYears();
        }).catch(() => {
            showToast({ message: t('timeTrackingPage.invoices.registry.loadFailed'), variant: 'error' });
        });
    }, [canEditYear, persistArchiveRows, year, columnKeys, t, refreshYears]);
    const resetToSeed = useCallback(() => {
        if (readOnly)
            return;
        setLoading(true);
        void loadInvoiceRegistryRows(year)
            .then(async ({ rows: seedRows }) => {
            if (year === '2026')
                await replaceInvoiceRegistryRows2026(seedRows, { force: seedRows.length === 0, seedRevision: MANUAL_2026_SEED_REVISION });
            else if (year !== '2026-system')
                await replaceInvoiceRegistryArchiveSheet(year, seedRows, { force: seedRows.length === 0 });
            return getInvoiceRegistrySheetApi(year);
        })
            .then((loadedSheet) => {
            setRows(Array.isArray(loadedSheet.rows) ? loadedSheet.rows : []);
            setSheetMode(loadedSheet.mode === 'archive' || loadedSheet.mode === 'system' ? loadedSheet.mode : 'active');
            setDirty(false);
            showToast({
                message: t('timeTrackingPage.invoices.registry.resetDone'),
                variant: 'info',
            });
            refreshYears();
        })
            .catch(() => {
            showToast({
                message: t('timeTrackingPage.invoices.registry.loadFailed'),
                variant: 'error',
            });
        })
            .finally(() => setLoading(false));
    }, [readOnly, year, t, refreshYears]);
    useEffect(() => {
        if (!fullscreen)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !focus) {
                e.preventDefault();
                setFullscreen(false);
            }
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [fullscreen, focus]);
    const panel = (_jsxs("div", { className: `tt-inv-reg${fullscreen ? ' tt-inv-reg--fullscreen' : ''}`, role: "tabpanel", "aria-label": t('timeTrackingPage.invoices.tabs.registry'), children: [_jsxs("div", { className: "tt-inv-reg__toolbar", children: [_jsx("nav", { className: "tt-reports__type-nav tt-inv-reg__year-nav", role: "tablist", "aria-label": t('timeTrackingPage.invoices.registry.yearTabsAria'), children: (years.length > 0 ? years : [{ id: '2026', sheetName: 'Инвойс 2026', mode: 'active', rowCount: rows.length }]).map((s) => (_jsx("button", { type: "button", role: "tab", "aria-selected": year === s.id, className: `tt-reports__type-tab${year === s.id ? ' tt-reports__type-tab--active' : ''}`, onClick: () => {
                                setYear(s.id);
                                try {
                                    window.sessionStorage.setItem(REGISTRY_YEAR_KEY, s.id);
                                }
                                catch {
                                    /* private mode */
                                }
                            }, children: s.id === 'checklist'
                                ? t('timeTrackingPage.invoices.registry.checklistTab')
                                : s.id === '2026-system'
                                    ? t('timeTrackingPage.invoices.registry.systemTab')
                                    : s.id }, s.id))) }), _jsxs("div", { className: "tt-inv-reg__toolbar-actions", children: [_jsx("input", { type: "search", className: "tt-settings__search tt-inv-reg__search", placeholder: t('timeTrackingPage.invoices.registry.searchPlaceholder'), value: search, onChange: (e) => setSearch(e.target.value), "aria-label": t('timeTrackingPage.invoices.registry.searchAria') }), !readOnly && (_jsxs(_Fragment, { children: [canEditYear && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: addRow, disabled: loading, children: t('timeTrackingPage.invoices.registry.addRow') })), year !== '2026-system' && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: resetToSeed, disabled: loading, title: rows.length === 0
                                            ? t('timeTrackingPage.invoices.registry.seedHint')
                                            : t('timeTrackingPage.invoices.registry.resetHint'), children: rows.length === 0
                                            ? t('timeTrackingPage.invoices.registry.seedFromExcel')
                                            : t('timeTrackingPage.invoices.registry.reset') }))] })), _jsx("button", { type: "button", className: "tt-inv-reg__fullscreen-btn", onClick: () => setFullscreen((v) => !v), title: fullscreen
                                    ? t('timeTrackingPage.invoices.registry.exitFullscreen')
                                    : t('timeTrackingPage.invoices.registry.enterFullscreen'), "aria-label": fullscreen
                                    ? t('timeTrackingPage.invoices.registry.exitFullscreen')
                                    : t('timeTrackingPage.invoices.registry.enterFullscreen'), "aria-pressed": fullscreen, children: _jsx(IcoFullscreen, { exit: fullscreen }) })] })] }), _jsxs("div", { className: "tt-inv-reg__filters", children: [_jsxs("select", { className: "tt-inv-reg__filter", value: "", "aria-label": t('timeTrackingPage.invoices.registry.filterPartner'), onChange: (e) => {
                            if (e.target.value)
                                togglePartner(e.target.value);
                        }, children: [_jsx("option", { value: "", children: t('timeTrackingPage.invoices.registry.filterPartnerAll') }), partnerOptions.map((code) => (_jsx("option", { value: code, children: partners.has(code) ? `✓ ${code}` : code }, code)))] }), _jsx("input", { type: "search", className: "tt-settings__search tt-inv-reg__filter tt-inv-reg__filter--number", placeholder: t('timeTrackingPage.invoices.registry.filterNumber'), "aria-label": t('timeTrackingPage.invoices.registry.filterNumber'), value: numberQuery, onChange: (e) => setNumberQuery(e.target.value) }), _jsxs("label", { className: "tt-inv-reg__filter-label", children: [t('timeTrackingPage.invoices.registry.filterDateFrom'), _jsx(DatePicker, { className: "tt-inv-reg__date", value: dateFrom, max: dateTo || undefined, portal: true, portalZIndex: 1400, emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433", showChevron: false, title: t('timeTrackingPage.invoices.registry.filterDateFrom'), onChange: setDateFrom })] }), _jsxs("label", { className: "tt-inv-reg__filter-label", children: [t('timeTrackingPage.invoices.registry.filterDateTo'), _jsx(DatePicker, { className: "tt-inv-reg__date", value: dateTo, min: dateFrom || undefined, portal: true, portalZIndex: 1400, emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433", showChevron: false, title: t('timeTrackingPage.invoices.registry.filterDateTo'), onChange: setDateTo })] }), _jsx(RegistryMonthMenu, { labels: monthLabels, selected: months, allLabel: t('timeTrackingPage.invoices.registry.filterMonthAll'), ariaLabel: t('timeTrackingPage.invoices.registry.filterMonth'), onToggle: toggleMonth }), filtersActive && (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: clearFilters, children: t('timeTrackingPage.invoices.registry.filterClear') })), (partners.size > 0 || months.size > 0) && (_jsxs("div", { className: "tt-inv-reg__chips", children: [[...partners].map((code) => (_jsxs("button", { type: "button", className: "tt-inv-reg__chip", onClick: () => togglePartner(code), children: [code, _jsx("span", { "aria-hidden": true, children: "\u00D7" })] }, code))), [...months].sort((a, b) => a - b).map((month) => (_jsxs("button", { type: "button", className: "tt-inv-reg__chip", onClick: () => toggleMonth(month), children: [monthLabels[month - 1], _jsx("span", { "aria-hidden": true, children: "\u00D7" })] }, month)))] }))] }), _jsxs("p", { className: "tt-inv-reg__meta", children: [t('timeTrackingPage.invoices.registry.sheetLabel').replace('{sheet}', sheet.sheetName), ' · ', t('timeTrackingPage.invoices.registry.rowCount')
                        .replace('{shown}', String(filteredRows.length))
                        .replace('{total}', String(rows.length)), dirty ? ` · ${t('timeTrackingPage.invoices.registry.savedOnServer')}` : '', sheetMode === 'system' ? ` · ${t('timeTrackingPage.invoices.registry.systemReadonly')}` : ''] }), loading ? (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.common.loading') })) : (_jsx("div", { className: "tt-inv-reg__table-wrap", children: _jsxs("table", { className: `tt-inv-reg__table${canEditYear ? ' tt-inv-reg__table--editable' : ''}`, role: "grid", children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((col) => (_jsx("th", { className: `tt-inv-reg__th${col.wide ? ' tt-inv-reg__th--wide' : ''}${col.key === 'seqNo' ? ' tt-inv-reg__th--pin' : ''}`, scope: "col", title: col.label, children: col.label }, col.key))) }) }), _jsx("tbody", { children: filteredRows.length === 0 ? (_jsx("tr", { children: _jsx("td", { className: "tt-inv-reg__empty-cell", colSpan: columns.length, children: search.trim()
                                        ? t('timeTrackingPage.invoices.registry.noRows')
                                        : t('timeTrackingPage.invoices.registry.emptyDb') }) })) : filteredRows.map((row, idx) => {
                                const invoiceId = systemInvoiceId(row);
                                const canOpenInvoice = Boolean(invoiceId) && !canEditYear;
                                return (_jsx("tr", { className: `tt-inv-reg__tr${canOpenInvoice ? ' tt-inv-reg__tr--openable' : ''}`, tabIndex: canOpenInvoice ? 0 : undefined, "aria-label": canOpenInvoice
                                        ? t('timeTrackingPage.invoices.registry.openInvoiceAria')
                                            .replace('{number}', String(row.clientNumber || invoiceId))
                                        : undefined, onClick: (event) => {
                                        if (!canOpenInvoice)
                                            return;
                                        const target = event.target;
                                        if (target?.closest('button, a, input, textarea, select, .tt-inv-reg__td--status, .tt-inv-reg__td--pdf, .tt-inv-reg-status'))
                                            return;
                                        openInvoiceDetail(invoiceId);
                                    }, onKeyDown: (event) => {
                                        if (!canOpenInvoice)
                                            return;
                                        if (event.key !== 'Enter' && event.key !== ' ')
                                            return;
                                        const target = event.target;
                                        if (target?.closest('button, a, input, textarea, select, .tt-inv-reg__td--status, .tt-inv-reg__td--pdf, .tt-inv-reg-status'))
                                            return;
                                        event.preventDefault();
                                        openInvoiceDetail(invoiceId);
                                    }, children: columns.map((col) => {
                                        const val = row[col.key] ?? '';
                                        const active = focus?.rowId === row.id && focus.key === col.key;
                                        const money = isInvoiceRegistryMoneyColumnKey(col.key);
                                        const systemStatus = year === '2026-system' && col.key === 'statusNote';
                                        return (_jsx(RegistryEditableCell, { value: val, wide: col.wide, columnKey: col.key, editor: col.editor, invoiceId: invoiceId, money: money, readOnly: systemStatus ? readOnly : !canEditYear, statusChoices: statusChoices, allowCustomStatus: !systemStatus, active: canEditYear && active && col.editor !== 'status', ariaLabel: `${col.label}, ${t('timeTrackingPage.invoices.registry.rowN').replace('{n}', String(idx + 1))}`, onActivate: () => {
                                                if (canEditYear && col.editor !== 'status')
                                                    setFocus({ rowId: row.id, key: col.key });
                                            }, onChange: (next) => patchCell(row.id, col.key, next), onBlurCommit: () => setFocus(null) }, col.key));
                                    }) }, row.id));
                            }) })] }) }))] }));
    if (fullscreen && typeof document !== 'undefined')
        return createPortal(panel, document.body);
    return panel;
}
