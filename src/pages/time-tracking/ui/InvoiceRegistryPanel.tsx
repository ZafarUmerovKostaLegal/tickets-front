import './TimeTrackingForms.css';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getInvoiceDetailUrl } from '@shared/config';
import {
    formatAdvanceFeeLines,
    formatRegistryAmountCell,
    SYSTEM_INVOICE_REGISTRY_STATUSES,
    collectRegistryStatusOptions,
    filterInvoiceRegistryRows,
    getInvoiceRegistrySheet,
    isInvoiceRegistryMoneyColumnKey,
    registryStatusToneClass,
    loadInvoiceRegistryRows,
    type InvoiceRegistryRow,
    type InvoiceRegistryYearId,
} from '@entities/time-tracking/model/invoiceRegistry';
import {
    cancelInvoice,
    markInvoiceViewed,
    sendInvoice,
    unsendInvoice,
} from '@entities/time-tracking/api/domains/invoices';
import {
    createInvoiceRegistryRow2026,
    getInvoiceRegistrySheet as getInvoiceRegistrySheetApi,
    getInvoiceRegistryYears,
    MANUAL_2026_SEED_REVISION,
    patchInvoiceRegistryRow2026,
    replaceInvoiceRegistryArchiveSheet,
    replaceInvoiceRegistryRows2026,
    type InvoiceRegistryYearMeta,
} from '@entities/time-tracking/api/domains/invoiceRegistry';
import { downloadExistingInvoicePdf } from '../lib/invoicePageShared';
import { useI18n } from '@shared/i18n';
import { DatePicker } from '@shared/ui/DatePicker';
import { showToast } from '@shared/ui/app-toast';
import './InvoiceRegistryPanel.css';

type FocusCell = { rowId: string; key: string } | null;

function RegistryStatusDropdown({
    value,
    ariaLabel,
    readOnly,
    choices,
    allowCustom = true,
    onChange,
}: {
    value: string;
    ariaLabel: string;
    readOnly?: boolean;
    choices: readonly string[];
    allowCustom?: boolean;
    onChange: (next: string) => void;
}) {
    const uid = useId();
    const listId = `${uid}-list`;
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

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
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        const onPointer = (e: PointerEvent) => {
            const t = e.target as Node;
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

    return (
        <div className="tt-inv-reg-status">
            <button
                ref={btnRef}
                type="button"
                className={`tt-inv-reg-status__btn ${registryStatusToneClass(value)}${open ? ' tt-inv-reg-status__btn--open' : ''}`}
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={open ? listId : undefined}
                disabled={readOnly}
                title={value || undefined}
                onClick={() => {
                    if (readOnly)
                        return;
                    setDraft(value);
                    setOpen((v) => !v);
                }}
            >
                <span className="tt-inv-reg-status__label">{label}</span>
                <span className="tt-inv-reg-status__chev" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </span>
            </button>
            {open && !readOnly && menuPos && createPortal(
                <div
                    ref={menuRef}
                    id={listId}
                    className="tt-inv-reg-status__menu"
                    role="listbox"
                    style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
                >
                    {options.map((opt) => {
                        const selected = opt.value === value;
                        return (
                            <button
                                key={opt.value || '__empty'}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={`tt-inv-reg-status__opt${selected ? ' tt-inv-reg-status__opt--active' : ''}`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                <span className={`tt-inv-reg-status__dot ${registryStatusToneClass(opt.value)}`} aria-hidden />
                                {opt.label}
                            </button>
                        );
                    })}
                    {allowCustom && (
                    <form
                        className="tt-inv-reg-status__custom"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onChange(draft.trim());
                            setOpen(false);
                        }}
                    >
                        <input
                            className="tt-inv-reg-status__custom-input"
                            value={draft}
                            aria-label={ariaLabel}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                    </form>
                    )}
                </div>,
                document.body,
            )}
        </div>
    );
}

async function applySystemRegistryStatus(invoiceId: string, label: string): Promise<void> {
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

function systemInvoiceId(row: InvoiceRegistryRow): string {
    const explicit = String(row.invoiceId ?? '').trim();
    if (explicit)
        return explicit;
    return row.id.startsWith('sys-') ? row.id.slice(4) : '';
}

function RegistryPdfButton({ invoiceId, ariaLabel }: { invoiceId: string; ariaLabel: string }) {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    return (
        <button
            type="button"
            className="tt-inv-reg__pdf"
            disabled={!invoiceId || busy}
            aria-label={ariaLabel}
            onClick={() => {
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
            }}
        >
            PDF
        </button>
    );
}

function IcoFullscreen({ exit }: { exit?: boolean }) {
    if (exit) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
            </svg>
        );
    }
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
    );
}

function emptyRow(year: InvoiceRegistryYearId, keys: string[], index: number): InvoiceRegistryRow {
    const row: InvoiceRegistryRow = { id: `${year}-new-${Date.now()}-${index}` };
    for (const k of keys)
        row[k] = k === 'statusNote' ? 'Черновик' : '';
    return row;
}

function AdvanceFeeReadout({ value }: { value: string }) {
    const lines = formatAdvanceFeeLines(value);
    if (lines.length === 0)
        return <span className="tt-inv-reg__cell-text">{'\u00a0'}</span>;
    return (
        <ul className="tt-inv-reg-fee">
            {lines.map((line, index) => (
                'partner' in line ? (
                    <li key={`${line.partner}-${index}`} className="tt-inv-reg-fee__row">
                        <span className="tt-inv-reg-fee__code">{line.partner}</span>
                        <span className="tt-inv-reg-fee__amounts">
                            {line.amounts.map((amount, amountIndex) => (
                                <span key={`${amount}-${amountIndex}`} className="tt-inv-reg-fee__amt">{amount}</span>
                            ))}
                        </span>
                    </li>
                ) : (
                    <li key={`text-${index}`} className="tt-inv-reg-fee__plain">{line.text}</li>
                )
            ))}
        </ul>
    );
}

function RegistryEditableCell({
    value,
    ariaLabel,
    wide,
    columnKey,
    editor = 'text',
    money = false,
    readOnly,
    active,
    invoiceId = '',
    statusChoices,
    allowCustomStatus = true,
    onActivate,
    onChange,
    onBlurCommit,
}: {
    value: string;
    ariaLabel: string;
    wide?: boolean;
    columnKey?: string;
    editor?: 'text' | 'status' | 'pdf';
    money?: boolean;
    readOnly?: boolean;
    active: boolean;
    invoiceId?: string;
    statusChoices: readonly string[];
    allowCustomStatus?: boolean;
    onActivate: () => void;
    onChange: (next: string) => void;
    onBlurCommit: () => void;
}) {
    const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
    const isMoney = money && editor === 'text';
    useEffect(() => {
        if (active && editor === 'text' && ref.current) {
            ref.current.focus();
            if ('select' in ref.current)
                ref.current.select();
        }
    }, [active, editor]);

    if (editor === 'pdf') {
        return (
            <td className="tt-inv-reg__td tt-inv-reg__td--pdf">
                <RegistryPdfButton invoiceId={invoiceId} ariaLabel={ariaLabel} />
            </td>
        );
    }

    if (editor === 'status') {
        return (
            <td className="tt-inv-reg__td tt-inv-reg__td--status">
                <RegistryStatusDropdown
                    value={value}
                    ariaLabel={ariaLabel}
                    readOnly={readOnly}
                    choices={statusChoices}
                    allowCustom={allowCustomStatus}
                    onChange={onChange}
                />
            </td>
        );
    }

    if (!active) {
        const display = isMoney ? formatRegistryAmountCell(value) : value;
        const fee = columnKey === 'advanceFee';
        return (
            <td
                className={`tt-inv-reg__td${wide ? ' tt-inv-reg__td--wide' : ''}${isMoney ? ' tt-inv-reg__td--money' : ''}${fee ? ' tt-inv-reg__td--fee' : ''}${columnKey === 'seqNo' ? ' tt-inv-reg__td--pin' : ''}`}
                onClick={onActivate}
                onFocus={onActivate}
                tabIndex={0}
                role="gridcell"
                aria-label={ariaLabel}
                title={fee ? value : (display || undefined)}
            >
                {fee ? <AdvanceFeeReadout value={value} /> : <span className="tt-inv-reg__cell-text">{display || '\u00a0'}</span>}
            </td>
        );
    }

    const multiline = !isMoney && (wide || value.includes('\n') || value.length > 48);
    if (multiline) {
        return (
            <td className={`tt-inv-reg__td tt-inv-reg__td--editing${wide ? ' tt-inv-reg__td--wide' : ''}`}>
                <textarea
                    ref={(el) => { ref.current = el; }}
                    className="tt-inv-reg__input tt-inv-reg__input--area"
                    value={value}
                    aria-label={ariaLabel}
                    rows={Math.min(6, Math.max(2, value.split('\n').length + 1))}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => {
                        if (isMoney) {
                            const next = formatRegistryAmountCell(value);
                            if (next !== value)
                                onChange(next);
                        }
                        onBlurCommit();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                        }
                    }}
                />
            </td>
        );
    }

    return (
        <td className={`tt-inv-reg__td tt-inv-reg__td--editing${isMoney ? ' tt-inv-reg__td--money' : ''}`}>
            <input
                ref={(el) => { ref.current = el; }}
                type="text"
                inputMode={isMoney ? 'decimal' : undefined}
                className="tt-inv-reg__input"
                value={value}
                aria-label={ariaLabel}
                onChange={(e) => onChange(e.target.value)}
                onBlur={(e) => {
                    if (isMoney) {
                        const next = formatRegistryAmountCell(e.currentTarget.value);
                        if (next !== value)
                            onChange(next);
                    }
                    onBlurCommit();
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                    }
                }}
            />
        </td>
    );
}

function RegistryMonthMenu({
    labels,
    selected,
    allLabel,
    ariaLabel,
    onToggle,
}: {
    labels: string[];
    selected: Set<number>;
    allLabel: string;
    ariaLabel: string;
    onToggle: (month: number) => void;
}) {
    const uid = useId();
    const listId = `${uid}-months`;
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

    const buttonLabel = selected.size === 0
        ? allLabel
        : selected.size === 1
            ? labels[[...selected][0]! - 1] ?? allLabel
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
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        const onPointer = (e: PointerEvent) => {
            const t = e.target as Node;
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

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                className={`tt-inv-reg__filter tt-inv-reg__month-btn${open ? ' tt-inv-reg__month-btn--open' : ''}`}
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={open ? listId : undefined}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="tt-inv-reg__month-btn-label">{buttonLabel}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            </button>
            {open && menuPos && createPortal(
                <div
                    ref={menuRef}
                    id={listId}
                    className="tt-inv-reg__month-menu"
                    role="listbox"
                    aria-multiselectable
                    style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
                >
                    {labels.map((label, index) => {
                        const month = index + 1;
                        const on = selected.has(month);
                        return (
                            <button
                                key={label}
                                type="button"
                                role="option"
                                aria-selected={on}
                                className={`tt-inv-reg__month-opt${on ? ' tt-inv-reg__month-opt--on' : ''}`}
                                onClick={() => onToggle(month)}
                            >
                                <span className="tt-inv-reg__month-check" aria-hidden>{on ? '✓' : ''}</span>
                                {label}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </>
    );
}

const REGISTRY_YEAR_KEY = 'tt-inv-reg-year';
const REGISTRY_YEARS = new Set<InvoiceRegistryYearId>([
    '2026', '2026-system', '2025', '2024', '2023', '2022', '2021', '2020', 'checklist',
]);

function readRegistryYear(): InvoiceRegistryYearId {
    try {
        const saved = window.sessionStorage.getItem(REGISTRY_YEAR_KEY);
        if (saved && REGISTRY_YEARS.has(saved as InvoiceRegistryYearId))
            return saved as InvoiceRegistryYearId;
    }
    catch {
        /* private mode */
    }
    return '2026';
}

export function InvoiceRegistryPanel({
    readOnly = false,
    variant = 'default',
}: {
    readOnly?: boolean;
    variant?: 'default' | 'accounting';
}) {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const accountingEmbed = variant === 'accounting';
    const openInvoiceDetail = useCallback((invoiceId: string) => {
        const id = invoiceId.trim();
        if (!id)
            return;
        navigate(getInvoiceDetailUrl(id, accountingEmbed ? { variant: 'accounting' } : undefined));
    }, [accountingEmbed, navigate]);
    const [year, setYear] = useState<InvoiceRegistryYearId>(readRegistryYear);
    const [rows, setRows] = useState<InvoiceRegistryRow[]>([]);
    const [years, setYears] = useState<InvoiceRegistryYearMeta[]>([]);
    const [sheetMode, setSheetMode] = useState<'active' | 'archive' | 'system'>('active');
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [focus, setFocus] = useState<FocusCell>(null);
    const [search, setSearch] = useState('');
    const [partners, setPartners] = useState<Set<string>>(() => new Set());
    const [numberQuery, setNumberQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [months, setMonths] = useState<Set<number>>(() => new Set());
    const [fullscreen, setFullscreen] = useState(false);
    const sheet = useMemo(() => getInvoiceRegistrySheet(year), [year]);
    const columns = sheet.columns;
    const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);

    const canEditYear = !readOnly && year !== '2026-system' && year !== 'checklist';
    const seededYearsRef = useRef<Set<string>>(new Set());

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
                            await replaceInvoiceRegistryArchiveSheet(year as Exclude<InvoiceRegistryYearId, '2026' | '2026-system'>, seedRows);
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
    const archiveSaveTimer = useRef<number | null>(null);
    const pendingArchiveSave = useRef<{ year: InvoiceRegistryYearId; rows: InvoiceRegistryRow[] } | null>(null);

    const persistArchiveRows = useCallback((next: InvoiceRegistryRow[], sheetYear: InvoiceRegistryYearId) => {
        if (sheetYear === '2026' || sheetYear === '2026-system' || sheetYear === 'checklist')
            return;
        pendingArchiveSave.current = { year: sheetYear, rows: next };
        if (archiveSaveTimer.current !== null)
            window.clearTimeout(archiveSaveTimer.current);
        archiveSaveTimer.current = window.setTimeout(() => {
            archiveSaveTimer.current = null;
            pendingArchiveSave.current = null;
            void replaceInvoiceRegistryArchiveSheet(
                sheetYear as Exclude<InvoiceRegistryYearId, '2026' | '2026-system'>,
                next,
            ).catch(() => {
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
        void replaceInvoiceRegistryArchiveSheet(
            pending.year as Exclude<InvoiceRegistryYearId, '2026' | '2026-system'>,
            pending.rows,
        );
    }, [year]);

    const partnerOptions = useMemo(() => {
        const codes = new Set<string>();
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

    const togglePartner = (code: string) => {
        setPartners((prev) => {
            const next = new Set(prev);
            if (next.has(code))
                next.delete(code);
            else
                next.add(code);
            return next;
        });
    };
    const toggleMonth = (month: number) => {
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

    const patchCell = useCallback((rowId: string, key: string, value: string) => {
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
                .catch((error: unknown) => {
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
                    await replaceInvoiceRegistryArchiveSheet(year as Exclude<InvoiceRegistryYearId, '2026' | '2026-system'>, seedRows, { force: seedRows.length === 0 });
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
        const onKey = (e: KeyboardEvent) => {
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

    const panel = (
        <div className={`tt-inv-reg${fullscreen ? ' tt-inv-reg--fullscreen' : ''}`} role="tabpanel" aria-label={t('timeTrackingPage.invoices.tabs.registry')}>
            <div className="tt-inv-reg__toolbar">
                <nav className="tt-reports__type-nav tt-inv-reg__year-nav" role="tablist" aria-label={t('timeTrackingPage.invoices.registry.yearTabsAria')}>
                    {(years.length > 0 ? years : [{ id: '2026', sheetName: 'Инвойс 2026', mode: 'active', rowCount: rows.length } as InvoiceRegistryYearMeta]).map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            role="tab"
                            aria-selected={year === s.id}
                            className={`tt-reports__type-tab${year === s.id ? ' tt-reports__type-tab--active' : ''}`}
                            onClick={() => {
                                setYear(s.id);
                                try {
                                    window.sessionStorage.setItem(REGISTRY_YEAR_KEY, s.id);
                                }
                                catch {
                                    /* private mode */
                                }
                            }}
                        >
                            {s.id === 'checklist'
                                ? t('timeTrackingPage.invoices.registry.checklistTab')
                                : s.id === '2026-system'
                                    ? t('timeTrackingPage.invoices.registry.systemTab')
                                    : s.id}
                        </button>
                    ))}
                </nav>
                <div className="tt-inv-reg__toolbar-actions">
                    <input
                        type="search"
                        className="tt-settings__search tt-inv-reg__search"
                        placeholder={t('timeTrackingPage.invoices.registry.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label={t('timeTrackingPage.invoices.registry.searchAria')}
                    />
                    {!readOnly && (
                        <>
                            {canEditYear && (
                                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={addRow} disabled={loading}>
                                    {t('timeTrackingPage.invoices.registry.addRow')}
                                </button>
                            )}
                            {year !== '2026-system' && (
                            <button
                                type="button"
                                className="tt-reports__btn tt-reports__btn--outline"
                                onClick={resetToSeed}
                                disabled={loading}
                                title={rows.length === 0
                                    ? t('timeTrackingPage.invoices.registry.seedHint')
                                    : t('timeTrackingPage.invoices.registry.resetHint')}
                            >
                                {rows.length === 0
                                    ? t('timeTrackingPage.invoices.registry.seedFromExcel')
                                    : t('timeTrackingPage.invoices.registry.reset')}
                            </button>
                            )}
                        </>
                    )}
                    <button
                        type="button"
                        className="tt-inv-reg__fullscreen-btn"
                        onClick={() => setFullscreen((v) => !v)}
                        title={fullscreen
                            ? t('timeTrackingPage.invoices.registry.exitFullscreen')
                            : t('timeTrackingPage.invoices.registry.enterFullscreen')}
                        aria-label={fullscreen
                            ? t('timeTrackingPage.invoices.registry.exitFullscreen')
                            : t('timeTrackingPage.invoices.registry.enterFullscreen')}
                        aria-pressed={fullscreen}
                    >
                        <IcoFullscreen exit={fullscreen} />
                    </button>
                </div>
            </div>

            <div className="tt-inv-reg__filters">
                <select
                    className="tt-inv-reg__filter"
                    value=""
                    aria-label={t('timeTrackingPage.invoices.registry.filterPartner')}
                    onChange={(e) => {
                        if (e.target.value)
                            togglePartner(e.target.value);
                    }}
                >
                    <option value="">{t('timeTrackingPage.invoices.registry.filterPartnerAll')}</option>
                    {partnerOptions.map((code) => (
                        <option key={code} value={code}>{partners.has(code) ? `✓ ${code}` : code}</option>
                    ))}
                </select>
                <input
                    type="search"
                    className="tt-settings__search tt-inv-reg__filter tt-inv-reg__filter--number"
                    placeholder={t('timeTrackingPage.invoices.registry.filterNumber')}
                    aria-label={t('timeTrackingPage.invoices.registry.filterNumber')}
                    value={numberQuery}
                    onChange={(e) => setNumberQuery(e.target.value)}
                />
                <label className="tt-inv-reg__filter-label">
                    {t('timeTrackingPage.invoices.registry.filterDateFrom')}
                    <DatePicker
                        className="tt-inv-reg__date"
                        value={dateFrom}
                        max={dateTo || undefined}
                        portal
                        portalZIndex={1400}
                        emptyLabel="дд.мм.гггг"
                        showChevron={false}
                        title={t('timeTrackingPage.invoices.registry.filterDateFrom')}
                        onChange={setDateFrom}
                    />
                </label>
                <label className="tt-inv-reg__filter-label">
                    {t('timeTrackingPage.invoices.registry.filterDateTo')}
                    <DatePicker
                        className="tt-inv-reg__date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        portal
                        portalZIndex={1400}
                        emptyLabel="дд.мм.гггг"
                        showChevron={false}
                        title={t('timeTrackingPage.invoices.registry.filterDateTo')}
                        onChange={setDateTo}
                    />
                </label>
                <RegistryMonthMenu
                    labels={monthLabels}
                    selected={months}
                    allLabel={t('timeTrackingPage.invoices.registry.filterMonthAll')}
                    ariaLabel={t('timeTrackingPage.invoices.registry.filterMonth')}
                    onToggle={toggleMonth}
                />
                {filtersActive && (
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={clearFilters}>
                        {t('timeTrackingPage.invoices.registry.filterClear')}
                    </button>
                )}
                {(partners.size > 0 || months.size > 0) && (
                    <div className="tt-inv-reg__chips">
                        {[...partners].map((code) => (
                            <button key={code} type="button" className="tt-inv-reg__chip" onClick={() => togglePartner(code)}>
                                {code}
                                <span aria-hidden>×</span>
                            </button>
                        ))}
                        {[...months].sort((a, b) => a - b).map((month) => (
                            <button key={month} type="button" className="tt-inv-reg__chip" onClick={() => toggleMonth(month)}>
                                {monthLabels[month - 1]}
                                <span aria-hidden>×</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <p className="tt-inv-reg__meta">
                {t('timeTrackingPage.invoices.registry.sheetLabel').replace('{sheet}', sheet.sheetName)}
                {' · '}
                {t('timeTrackingPage.invoices.registry.rowCount')
                    .replace('{shown}', String(filteredRows.length))
                    .replace('{total}', String(rows.length))}
                {dirty ? ` · ${t('timeTrackingPage.invoices.registry.savedOnServer')}` : ''}
                {sheetMode === 'system' ? ` · ${t('timeTrackingPage.invoices.registry.systemReadonly')}` : ''}
            </p>

            {loading ? (
                <p className="tt-tm-hint" role="status">{t('timeTrackingPage.common.loading')}</p>
            ) : (
                <div className="tt-inv-reg__table-wrap">
                    <table className={`tt-inv-reg__table${canEditYear ? ' tt-inv-reg__table--editable' : ''}`} role="grid">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`tt-inv-reg__th${col.wide ? ' tt-inv-reg__th--wide' : ''}${col.key === 'seqNo' ? ' tt-inv-reg__th--pin' : ''}`}
                                        scope="col"
                                        title={col.label}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td
                                        className="tt-inv-reg__empty-cell"
                                        colSpan={columns.length}
                                    >
                                        {search.trim()
                                            ? t('timeTrackingPage.invoices.registry.noRows')
                                            : t('timeTrackingPage.invoices.registry.emptyDb')}
                                    </td>
                                </tr>
                            ) : filteredRows.map((row, idx) => {
                                const invoiceId = systemInvoiceId(row);
                                const canOpenInvoice = Boolean(invoiceId) && !canEditYear;
                                return (
                                <tr
                                    key={row.id}
                                    className={`tt-inv-reg__tr${canOpenInvoice ? ' tt-inv-reg__tr--openable' : ''}`}
                                    tabIndex={canOpenInvoice ? 0 : undefined}
                                    aria-label={canOpenInvoice
                                        ? t('timeTrackingPage.invoices.registry.openInvoiceAria')
                                            .replace('{number}', String(row.clientNumber || invoiceId))
                                        : undefined}
                                    onClick={(event) => {
                                        if (!canOpenInvoice)
                                            return;
                                        const target = event.target as HTMLElement | null;
                                        if (target?.closest('button, a, input, textarea, select, .tt-inv-reg__td--status, .tt-inv-reg__td--pdf, .tt-inv-reg-status'))
                                            return;
                                        openInvoiceDetail(invoiceId);
                                    }}
                                    onKeyDown={(event) => {
                                        if (!canOpenInvoice)
                                            return;
                                        if (event.key !== 'Enter' && event.key !== ' ')
                                            return;
                                        const target = event.target as HTMLElement | null;
                                        if (target?.closest('button, a, input, textarea, select, .tt-inv-reg__td--status, .tt-inv-reg__td--pdf, .tt-inv-reg-status'))
                                            return;
                                        event.preventDefault();
                                        openInvoiceDetail(invoiceId);
                                    }}
                                >
                                    {columns.map((col) => {
                                        const val = row[col.key] ?? '';
                                        const active = focus?.rowId === row.id && focus.key === col.key;
                                        const money = isInvoiceRegistryMoneyColumnKey(col.key);
                                        const systemStatus = year === '2026-system' && col.key === 'statusNote';
                                        return (
                                            <RegistryEditableCell
                                                key={col.key}
                                                value={val}
                                                wide={col.wide}
                                                columnKey={col.key}
                                                editor={col.editor}
                                                invoiceId={invoiceId}
                                                money={money}
                                                readOnly={systemStatus ? readOnly : !canEditYear}
                                                statusChoices={statusChoices}
                                                allowCustomStatus={!systemStatus}
                                                active={canEditYear && active && col.editor !== 'status'}
                                                ariaLabel={`${col.label}, ${t('timeTrackingPage.invoices.registry.rowN').replace('{n}', String(idx + 1))}`}
                                                onActivate={() => {
                                                    if (canEditYear && col.editor !== 'status')
                                                        setFocus({ rowId: row.id, key: col.key });
                                                }}
                                                onChange={(next) => patchCell(row.id, col.key, next)}
                                                onBlurCommit={() => setFocus(null)}
                                            />
                                        );
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    if (fullscreen && typeof document !== 'undefined')
        return createPortal(panel, document.body);
    return panel;
}
