import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    INVOICE_REGISTRY_SHEETS,
    clearInvoiceRegistryOverrides,
    getInvoiceRegistrySheet,
    loadInvoiceRegistryRows,
    writeInvoiceRegistryOverrides,
    type InvoiceRegistryRow,
    type InvoiceRegistryYearId,
} from '@entities/time-tracking/model/invoiceRegistry';
import { useI18n } from '@shared/i18n';
import { showToast } from '@shared/ui/app-toast';
import './InvoiceRegistryPanel.css';

type FocusCell = { rowId: string; key: string } | null;

function emptyRow(year: InvoiceRegistryYearId, keys: string[], index: number): InvoiceRegistryRow {
    const row: InvoiceRegistryRow = { id: `${year}-new-${Date.now()}-${index}` };
    for (const k of keys)
        row[k] = '';
    return row;
}

function RegistryEditableCell({
    value,
    ariaLabel,
    wide,
    active,
    onActivate,
    onChange,
    onBlurCommit,
}: {
    value: string;
    ariaLabel: string;
    wide?: boolean;
    active: boolean;
    onActivate: () => void;
    onChange: (next: string) => void;
    onBlurCommit: () => void;
}) {
    const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
    useEffect(() => {
        if (active && ref.current) {
            ref.current.focus();
            if ('select' in ref.current)
                ref.current.select();
        }
    }, [active]);

    if (!active) {
        return (
            <td
                className={`tt-inv-reg__td${wide ? ' tt-inv-reg__td--wide' : ''}`}
                onClick={onActivate}
                onFocus={onActivate}
                tabIndex={0}
                role="gridcell"
                aria-label={ariaLabel}
                title={value || undefined}
            >
                <span className="tt-inv-reg__cell-text">{value || '\u00a0'}</span>
            </td>
        );
    }

    const multiline = wide || value.includes('\n') || value.length > 48;
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
                    onBlur={onBlurCommit}
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
        <td className="tt-inv-reg__td tt-inv-reg__td--editing">
            <input
                ref={(el) => { ref.current = el; }}
                type="text"
                className="tt-inv-reg__input"
                value={value}
                aria-label={ariaLabel}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlurCommit}
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
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [focus, setFocus] = useState<FocusCell>(null);
    const [search, setSearch] = useState('');
    const sheet = useMemo(() => getInvoiceRegistrySheet(year), [year]);
    const columns = sheet.columns;
    const columnKeys = useMemo(() => columns.map((c) => c.key), [columns]);

    const persist = useCallback((next: InvoiceRegistryRow[]) => {
        writeInvoiceRegistryOverrides(year, next);
        setDirty(true);
    }, [year]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFocus(null);
        setSearch('');
        void loadInvoiceRegistryRows(year)
            .then(({ rows: loaded, fromOverrides }) => {
                if (cancelled)
                    return;
                setRows(loaded);
                setDirty(fromOverrides);
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
        setRows((prev) => {
            const next = prev.map((r) => (r.id === rowId ? { ...r, [key]: value } : r));
            persist(next);
            return next;
        });
    }, [persist]);

    const addRow = useCallback(() => {
        setRows((prev) => {
            const next = [...prev, emptyRow(year, columnKeys, prev.length + 1)];
            persist(next);
            return next;
        });
    }, [year, columnKeys, persist]);

    const deleteRow = useCallback((rowId: string) => {
        setRows((prev) => {
            const next = prev.filter((r) => r.id !== rowId);
            persist(next);
            return next;
        });
        setFocus(null);
    }, [persist]);

    const resetToSeed = useCallback(() => {
        clearInvoiceRegistryOverrides(year);
        setLoading(true);
        void loadInvoiceRegistryRows(year)
            .then(({ rows: loaded }) => {
                setRows(loaded);
                setDirty(false);
                showToast({
                    message: t('timeTrackingPage.invoices.registry.resetDone'),
                    variant: 'info',
                });
            })
            .finally(() => setLoading(false));
    }, [year, t]);

    return (
        <div className="tt-inv-reg" role="tabpanel" aria-label={t('timeTrackingPage.invoices.tabs.registry')}>
            <div className="tt-inv-reg__toolbar">
                <nav className="tt-reports__type-nav tt-inv-reg__year-nav" role="tablist" aria-label={t('timeTrackingPage.invoices.registry.yearTabsAria')}>
                    {INVOICE_REGISTRY_SHEETS.map((s) => (
                        <button
                            key={s.year}
                            type="button"
                            role="tab"
                            aria-selected={year === s.year}
                            className={`tt-reports__type-tab${year === s.year ? ' tt-reports__type-tab--active' : ''}`}
                            onClick={() => setYear(s.year)}
                        >
                            {s.year === 'checklist'
                                ? t('timeTrackingPage.invoices.registry.checklistTab')
                                : s.year}
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
                </div>
            </div>

            <p className="tt-inv-reg__meta">
                {t('timeTrackingPage.invoices.registry.sheetLabel').replace('{sheet}', sheet.sheetName)}
                {' · '}
                {t('timeTrackingPage.invoices.registry.rowCount')
                    .replace('{shown}', String(filteredRows.length))
                    .replace('{total}', String(rows.length))}
                {dirty ? ` · ${t('timeTrackingPage.invoices.registry.savedLocally')}` : ''}
            </p>

            {loading ? (
                <p className="tt-tm-hint" role="status">{t('timeTrackingPage.common.loading')}</p>
            ) : (
                <div className="tt-inv-reg__table-wrap">
                    <table className="tt-inv-reg__table" role="grid">
                        <thead>
                            <tr>
                                {!readOnly && <th className="tt-inv-reg__th tt-inv-reg__th--actions" scope="col" />}
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
                                        colSpan={columns.length + (readOnly ? 0 : 1)}
                                    >
                                        {t('timeTrackingPage.invoices.registry.noRows')}
                                    </td>
                                </tr>
                            ) : filteredRows.map((row, idx) => (
                                <tr key={row.id} className="tt-inv-reg__tr">
                                    {!readOnly && (
                                        <td className="tt-inv-reg__td tt-inv-reg__td--actions">
                                            <button
                                                type="button"
                                                className="tt-inv-reg__del"
                                                aria-label={t('timeTrackingPage.invoices.registry.deleteRow')}
                                                title={t('timeTrackingPage.invoices.registry.deleteRow')}
                                                onClick={() => deleteRow(row.id)}
                                            >
                                                ×
                                            </button>
                                        </td>
                                    )}
                                    {columns.map((col) => {
                                        const val = row[col.key] ?? '';
                                        const active = focus?.rowId === row.id && focus.key === col.key;
                                        return (
                                            <RegistryEditableCell
                                                key={col.key}
                                                value={val}
                                                wide={col.wide}
                                                active={!readOnly && active}
                                                ariaLabel={`${col.label}, ${t('timeTrackingPage.invoices.registry.rowN').replace('{n}', String(idx + 1))}`}
                                                onActivate={() => {
                                                    if (!readOnly)
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
}
