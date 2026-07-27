import './TimeTrackingForms.css';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    INVOICE_REGISTRY_STATUSES,
    formatRegistryAmountCell,
    getInvoiceRegistrySheet,
    isInvoiceRegistryMoneyColumnKey,
    isInvoiceRegistryStatus,
    loadInvoiceRegistryRows,
    type InvoiceRegistryRow,
    type InvoiceRegistryYearId,
} from '@entities/time-tracking/model/invoiceRegistry';
import {
    createInvoiceRegistryRow2026,
    getInvoiceRegistrySheet as getInvoiceRegistrySheetApi,
    getInvoiceRegistryYears,
    patchInvoiceRegistryRow2026,
    replaceInvoiceRegistryRows2026,
    type InvoiceRegistryYearMeta,
} from '@entities/time-tracking/api/domains/invoiceRegistry';
import { useI18n } from '@shared/i18n';
import { showToast } from '@shared/ui/app-toast';
import './InvoiceRegistryPanel.css';

type FocusCell = { rowId: string; key: string } | null;

const STATUS_EMPTY = '';

function statusToneClass(value: string): string {
    if (value === 'Черновик')
        return 'tt-inv-reg-status--draft';
    if (value === 'На согласовании с Клиентом')
        return 'tt-inv-reg-status--review';
    if (value === 'Выставлен')
        return 'tt-inv-reg-status--issued';
    if (value === 'Оплачен')
        return 'tt-inv-reg-status--paid';
    if (value)
        return 'tt-inv-reg-status--legacy';
    return 'tt-inv-reg-status--empty';
}

function RegistryStatusDropdown({
    value,
    ariaLabel,
    readOnly,
    onChange,
}: {
    value: string;
    ariaLabel: string;
    readOnly?: boolean;
    onChange: (next: string) => void;
}) {
    const uid = useId();
    const listId = `${uid}-list`;
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

    const known = isInvoiceRegistryStatus(value);
    const label = value || '—';

    const options = useMemo(() => {
        const base: { value: string; label: string }[] = [
            { value: STATUS_EMPTY, label: '—' },
            ...INVOICE_REGISTRY_STATUSES.map((s) => ({ value: s, label: s })),
        ];
        if (value && !known)
            base.push({ value, label: value });
        return base;
    }, [value, known]);

    const updatePos = useCallback(() => {
        const btn = btnRef.current;
        if (!btn)
            return;
        const r = btn.getBoundingClientRect();
        const width = Math.max(r.width, 220);
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
                className={`tt-inv-reg-status__btn ${statusToneClass(value)}${open ? ' tt-inv-reg-status__btn--open' : ''}`}
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={open ? listId : undefined}
                disabled={readOnly}
                title={value || undefined}
                onClick={() => {
                    if (readOnly)
                        return;
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
                        const selected = opt.value === value || (!value && opt.value === STATUS_EMPTY);
                        const isLegacyOpt = Boolean(opt.value && !isInvoiceRegistryStatus(opt.value) && opt.value !== STATUS_EMPTY);
                        return (
                            <button
                                key={opt.value || '__empty'}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={`tt-inv-reg-status__opt${selected ? ' tt-inv-reg-status__opt--active' : ''}${isLegacyOpt ? ' tt-inv-reg-status__opt--legacy' : ''}`}
                                onClick={() => {
                                    if (isLegacyOpt)
                                        return;
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                <span className={`tt-inv-reg-status__dot ${statusToneClass(opt.value)}`} aria-hidden />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </div>
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

function RegistryEditableCell({
    value,
    ariaLabel,
    wide,
    editor = 'text',
    money = false,
    readOnly,
    active,
    onActivate,
    onChange,
    onBlurCommit,
}: {
    value: string;
    ariaLabel: string;
    wide?: boolean;
    editor?: 'text' | 'status';
    money?: boolean;
    readOnly?: boolean;
    active: boolean;
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

    if (editor === 'status') {
        return (
            <td className="tt-inv-reg__td tt-inv-reg__td--status">
                <RegistryStatusDropdown
                    value={value}
                    ariaLabel={ariaLabel}
                    readOnly={readOnly}
                    onChange={onChange}
                />
            </td>
        );
    }

    if (!active) {
        const display = isMoney ? formatRegistryAmountCell(value) : value;
        return (
            <td
                className={`tt-inv-reg__td${wide ? ' tt-inv-reg__td--wide' : ''}${isMoney ? ' tt-inv-reg__td--money' : ''}`}
                onClick={onActivate}
                onFocus={onActivate}
                tabIndex={0}
                role="gridcell"
                aria-label={ariaLabel}
                title={display || undefined}
            >
                <span className="tt-inv-reg__cell-text">{display || '\u00a0'}</span>
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

export function InvoiceRegistryPanel({ readOnly = false }: { readOnly?: boolean }) {
    const { t } = useI18n();
    const [year, setYear] = useState<InvoiceRegistryYearId>('2026');
    const [rows, setRows] = useState<InvoiceRegistryRow[]>([]);
    const [years, setYears] = useState<InvoiceRegistryYearMeta[]>([]);
    const [sheetMode, setSheetMode] = useState<'active' | 'archive'>('active');
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [focus, setFocus] = useState<FocusCell>(null);
    const [search, setSearch] = useState('');
    const [fullscreen, setFullscreen] = useState(false);
    const sheet = useMemo(() => getInvoiceRegistrySheet(year), [year]);
    const columns = sheet.columns;
    const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);

    const canEditYear = !readOnly && year === '2026' && sheetMode === 'active';

    useEffect(() => {
        let cancelled = false;
        void getInvoiceRegistryYears()
            .then((items) => {
                if (!cancelled)
                    setYears(items);
            })
            .catch(() => {
                if (!cancelled)
                    setYears([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFocus(null);
        setSearch('');
        void getInvoiceRegistrySheetApi(year)
            .then((loadedSheet) => {
                if (cancelled)
                    return;
                setRows(Array.isArray(loadedSheet.rows) ? loadedSheet.rows : []);
                setSheetMode(loadedSheet.mode === 'archive' ? 'archive' : 'active');
                setDirty(false);
            })
            .catch(() => {
                if (cancelled)
                    return;
                setRows([]);
                showToast({
                    message: t('timeTrackingPage.invoices.registry.loadFailed'),
                    variant: 'error',
                });
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [year, t]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return rows;
        return rows.filter((r) =>
            columnKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
    }, [rows, search, columnKeys]);

    const patchCell = useCallback((rowId: string, key: string, value: string) => {
        if (!canEditYear)
            return;
        setRows((prev) => {
            const next = prev.map((r) => (r.id === rowId ? { ...r, [key]: value } : r));
            setDirty(true);
            return next;
        });
        void patchInvoiceRegistryRow2026(rowId, { [key]: value })
            .catch(() => {
                showToast({
                    message: t('timeTrackingPage.invoices.registry.loadFailed'),
                    variant: 'error',
                });
            });
    }, [canEditYear, t]);

    const addRow = useCallback(() => {
        if (!canEditYear)
            return;
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
        }).catch(() => {
            showToast({ message: t('timeTrackingPage.invoices.registry.loadFailed'), variant: 'error' });
        });
    }, [canEditYear, year, columnKeys, t]);

    const resetToSeed = useCallback(() => {
        if (!canEditYear)
            return;
        setLoading(true);
        void loadInvoiceRegistryRows('2026')
            .then(({ rows: seedRows }) => replaceInvoiceRegistryRows2026(seedRows))
            .then(() => getInvoiceRegistrySheetApi('2026'))
            .then((loadedSheet) => {
                setRows(Array.isArray(loadedSheet.rows) ? loadedSheet.rows : []);
                setDirty(false);
                showToast({
                    message: t('timeTrackingPage.invoices.registry.resetDone'),
                    variant: 'info',
                });
            })
            .finally(() => setLoading(false));
    }, [canEditYear, t]);

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
                            onClick={() => setYear(s.id)}
                        >
                            {s.id === 'checklist'
                                ? t('timeTrackingPage.invoices.registry.checklistTab')
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
                    {canEditYear && (
                        <>
                            <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={addRow} disabled={loading}>
                                {t('timeTrackingPage.invoices.registry.addRow')}
                            </button>
                            <button
                                type="button"
                                className="tt-reports__btn tt-reports__btn--outline"
                                onClick={resetToSeed}
                                disabled={loading || !dirty}
                                title={t('timeTrackingPage.invoices.registry.resetHint')}
                            >
                                {t('timeTrackingPage.invoices.registry.reset')}
                            </button>
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

            <p className="tt-inv-reg__meta">
                {t('timeTrackingPage.invoices.registry.sheetLabel').replace('{sheet}', sheet.sheetName)}
                {' · '}
                {t('timeTrackingPage.invoices.registry.rowCount')
                    .replace('{shown}', String(filteredRows.length))
                    .replace('{total}', String(rows.length))}
                {dirty ? ` · ${t('timeTrackingPage.invoices.registry.savedLocally')}` : ''}
                {sheetMode === 'archive' ? ' · read-only' : ''}
            </p>

            {loading ? (
                <p className="tt-tm-hint" role="status">{t('timeTrackingPage.common.loading')}</p>
            ) : (
                <div className="tt-inv-reg__table-wrap">
                    <table className="tt-inv-reg__table" role="grid">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`tt-inv-reg__th${col.wide ? ' tt-inv-reg__th--wide' : ''}`}
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
                                        {t('timeTrackingPage.invoices.registry.noRows')}
                                    </td>
                                </tr>
                            ) : filteredRows.map((row, idx) => (
                                <tr key={row.id} className="tt-inv-reg__tr">
                                    {columns.map((col) => {
                                        const val = row[col.key] ?? '';
                                        const active = focus?.rowId === row.id && focus.key === col.key;
                                        const money = isInvoiceRegistryMoneyColumnKey(col.key);
                                        return (
                                            <RegistryEditableCell
                                                key={col.key}
                                                value={val}
                                                wide={col.wide}
                                                editor={col.editor}
                                                money={money}
                                                readOnly={!canEditYear}
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
                            ))}
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
