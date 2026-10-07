import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimesheetPanel.css';
import './TimeTrackingForms.css';
import './TimeTrackingPage.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes, getProjectDetailUrl, getInvoiceCreateUrl, getInvoiceDetailUrl } from '@shared/config';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { useAppDialog, useAppToast } from '@shared/ui';
import { useI18n, ttInvoiceStatusLabel } from '@shared/i18n';
import { listInvoices, getInvoicesAggregatedStats, deleteDraftInvoice, listAllTimeManagerClientsMerged, listAllClientProjectsMerged, listAllClientProjectsForClientMerged, listAllClientProjectsForPicker, isForbiddenError, INVOICE_STATUS_BADGE_CLASS, invoiceCanDeleteDraft, OPEN_INVOICE_DETAIL_QUERY, } from '@entities/time-tracking';
import { isActiveTimeManagerClientRow, isActiveTimeManagerProjectRow } from '@entities/time-tracking/lib/projectTimeEntry';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { fmtMoney, fmtDisplayDate, notifyReportsInvalidated } from '../lib/invoicePageShared';
import { enrichInvoicesWithDisplayMoney } from '../lib/invoiceExpenseLineDisplay';
import { InvoiceRegistryPanel } from './InvoiceRegistryPanel';
import { InvoiceRegistryStatisticsPanel } from './InvoiceRegistryStatisticsPanel';
function invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo) {
    const pid = projectFilter.trim();
    const from = listDateFrom.trim().slice(0, 10);
    const to = listDateTo.trim().slice(0, 10);
    if (!pid || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
        return {};
    return {
        partnerBillingProjectId: pid,
        partnerBillingPeriodFrom: from,
        partnerBillingPeriodTo: to,
    };
}
function applyInvoiceMutationToListRows(list, inv) {
    return list.map((row) => {
        if (row.id !== inv.id)
            return row;
        return {
            ...row,
            status: inv.status,
            storedStatus: inv.storedStatus,
            totalAmount: inv.totalAmount,
            amountPaid: inv.amountPaid,
            balanceDue: inv.balanceDue,
            ...(inv.payments !== undefined ? { payments: inv.payments } : {}),
            requiresPaymentConfirmationDocument: inv.requiresPaymentConfirmationDocument,
            paymentConfirmationDocumentUrl: inv.paymentConfirmationDocumentUrl,
            paymentConfirmationRecordedAt: inv.paymentConfirmationRecordedAt,
        };
    });
}
const IcoPlus = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }));
const IcoRefresh = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M23 4v6h-6" }), _jsx("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" })] }));
const IcoChevRight = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M9 18l6-6-6-6" }) }));
const IcoTrash = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }));
const IcoInvoiceEmpty = () => (_jsxs("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "8", y1: "13", x2: "16", y2: "13" }), _jsx("line", { x1: "8", y1: "17", x2: "14", y2: "17" })] }));
export function InvoicesPanel({ variant = 'default' }) {
    const accountingEmbed = variant === 'accounting';
    const readOnly = accountingEmbed;
    const { t, locale } = useI18n();
    const { showAlert, showConfirm } = useAppDialog();
    const { pushToast } = useAppToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [clients, setClients] = useState([]);
    const [clientsErr, setClientsErr] = useState(null);
    const [items, setItems] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listErr, setListErr] = useState(null);
    const [partnerListBlocked, setPartnerListBlocked] = useState(false);
    const [clientFilter, setClientFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [listProjectsFilter, setListProjectsFilter] = useState([]);
    const [listDateFrom, setListDateFrom] = useState('');
    const [listDateTo, setListDateTo] = useState('');
    const [invoiceListPage, setInvoiceListPage] = useState(1);
    const [invoiceListTotalCount, setInvoiceListTotalCount] = useState(null);
    const [aggStats, setAggStats] = useState(null);
    const [aggStatsLoading, setAggStatsLoading] = useState(false);
    const [aggStatsErr, setAggStatsErr] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);
    const INV_PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
    const clientNameById = useMemo(() => {
        const m = new Map();
        clients.forEach((c) => m.set(String(c.id), c.name));
        return m;
    }, [clients]);
    const clientFilterSearchItems = useMemo(() => [{ id: '', name: t('timeTrackingPage.common.allClients'), search: t('timeTrackingPage.invoices.filters.allClientsSearch') }, ...clients.map((c) => ({
            id: c.id,
            name: c.name,
            search: `${c.name} ${c.id}`.trim().toLowerCase(),
        }))], [clients, t]);
    const projectFilterSearchItems = useMemo(() => {
        const allOpt = { id: '', name: t('timeTrackingPage.invoices.filters.allProjects'), search: t('timeTrackingPage.invoices.filters.allProjectsSearch') };
        if (!clientFilter) {
            return [allOpt, ...listProjectsFilter.map((p) => {
                    const clientLabel = clientNameById.get(String(p.client_id)) ?? p.client_id;
                    const line = p.code ? `${p.name} (${p.code})` : p.name;
                    return {
                        id: p.id,
                        name: `${clientLabel} — ${line}`,
                        search: `${clientLabel} ${p.name} ${p.code ?? ''} ${p.id}`.trim().toLowerCase(),
                    };
                })];
        }
        return [allOpt, ...listProjectsFilter.map((p) => ({
                id: p.id,
                name: p.code ? `${p.name} (${p.code})` : p.name,
                search: `${p.name} ${p.code ?? ''} ${p.id}`.trim().toLowerCase(),
            }))];
    }, [clientFilter, listProjectsFilter, clientNameById, t]);
    const invoicePagerOffset = (invoiceListPage - 1) * INV_PAGE;
    const invoiceNextDisabled = listLoading || (invoiceListTotalCount != null
        ? invoicePagerOffset + items.length >= invoiceListTotalCount
        : items.length < INV_PAGE);
    const showInvoicePager = invoiceListPage > 1 || (items.length === INV_PAGE && (invoiceListTotalCount == null || invoicePagerOffset + items.length < invoiceListTotalCount));
    const listStatsFromAgg = useMemo(() => {
        if (!aggStats)
            return null;
        const by = aggStats.byEffectiveStatus;
        const n = (k) => by[k] ?? 0;
        return { drafts: n('draft') };
    }, [aggStats]);
    const loadClients = useCallback(() => {
        Promise.all([
            listAllTimeManagerClientsMerged(false),
            listAllClientProjectsMerged(false),
        ])
            .then(([clientRows, _projectRows]) => {
            setClients(clientRows.filter(isActiveTimeManagerClientRow));
            setClientsErr(null);
        })
            .catch((e) => {
            setClients([]);
            setClientsErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noClientAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
        });
    }, [t]);
    const loadList = useCallback((opts) => {
        const silent = Boolean(opts?.silent);
        const invoiceResponsePatch = opts?.invoiceResponsePatch;
        const signal = opts?.signal;
        if (!silent)
            setListLoading(true);
        setListErr(null);
        const billingGate = invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo);
        return listInvoices({
            status: 'draft',
            clientId: clientFilter || undefined,
            projectId: projectFilter || undefined,
            dateFrom: listDateFrom || undefined,
            dateTo: listDateTo || undefined,
            limit: INV_PAGE,
            offset: (invoiceListPage - 1) * INV_PAGE,
            includeTotalCount: true,
            ...billingGate,
        }, signal)
            .then(async (r) => {
            if (signal?.aborted)
                return;
            let rows = r.items;
            if (invoiceResponsePatch)
                rows = applyInvoiceMutationToListRows(rows, invoiceResponsePatch);
            setItems(rows);
            setPartnerListBlocked(r.partnerConfirmationBlocked === true);
            setInvoiceListTotalCount(typeof r.totalCount === 'number' ? r.totalCount : null);
            if (!silent && !signal?.aborted)
                setListLoading(false);
            // Align USD list Сумма/Остаток with expense registry (not issue-date FX).
            const enriched = await enrichInvoicesWithDisplayMoney(rows, signal);
            if (!signal?.aborted)
                setItems(enriched);
        })
            .catch((e) => {
            if (signal?.aborted)
                return;
            setItems([]);
            setPartnerListBlocked(false);
            setInvoiceListTotalCount(null);
            setListErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noInvoiceAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
        })
            .finally(() => {
            if (!silent && !signal?.aborted)
                setListLoading(false);
        });
    }, [clientFilter, projectFilter, listDateFrom, listDateTo, invoiceListPage, INV_PAGE, t]);
    const loadAggStats = useCallback((signal) => {
        setAggStatsLoading(true);
        setAggStatsErr(null);
        const billingGate = invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo);
        const filterBase = {
            status: 'draft',
            clientId: clientFilter || undefined,
            projectId: projectFilter || undefined,
            dateFrom: listDateFrom || undefined,
            dateTo: listDateTo || undefined,
            ...billingGate,
        };
        return getInvoicesAggregatedStats(filterBase, signal)
            .then((s) => {
            if (signal?.aborted)
                return;
            setAggStats(s);
        })
            .catch((e) => {
            if (signal?.aborted)
                return;
            setAggStats(null);
            setAggStatsErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noStatsAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
        })
            .finally(() => {
            if (!signal?.aborted)
                setAggStatsLoading(false);
        });
    }, [clientFilter, projectFilter, listDateFrom, listDateTo, t]);
    const changeClientFilter = useCallback((value) => {
        setClientFilter(value);
        setProjectFilter('');
        setInvoiceListPage(1);
    }, []);
    const changeProjectFilter = useCallback((value) => {
        setProjectFilter(value);
        setInvoiceListPage(1);
    }, []);
    const changeListDateFrom = useCallback((value) => {
        setListDateFrom(value);
        setInvoiceListPage(1);
    }, []);
    const changeListDateTo = useCallback((value) => {
        setListDateTo(value);
        setInvoiceListPage(1);
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void loadAggStats(controller.signal);
        return () => controller.abort();
    }, [loadAggStats]);
    useEffect(() => {
        if (!clientFilter) {
            listAllClientProjectsForPicker()
                .then((rows) => setListProjectsFilter(rows.filter((p) => isActiveTimeManagerProjectRow(p))))
                .catch(() => setListProjectsFilter([]));
            return;
        }
        listAllClientProjectsForClientMerged(clientFilter)
            .then((rows) => setListProjectsFilter(rows.filter((p) => isActiveTimeManagerProjectRow(p))))
            .catch(() => setListProjectsFilter([]));
    }, [clientFilter]);
    useEffect(() => {
        loadClients();
    }, [loadClients]);
    useEffect(() => {
        if (clientsErr)
            pushToast({ message: clientsErr, variant: 'warning' });
    }, [clientsErr, pushToast]);
    useEffect(() => {
        if (listErr)
            pushToast({ message: listErr, variant: 'error' });
    }, [listErr, pushToast]);
    useEffect(() => {
        if (aggStatsErr)
            pushToast({ message: aggStatsErr, variant: 'warning' });
    }, [aggStatsErr, pushToast]);
    useEffect(() => {
        const controller = new AbortController();
        void loadList({ signal: controller.signal });
        return () => controller.abort();
    }, [loadList]);
    const goToCreate = useCallback(() => {
        if (readOnly)
            return;
        navigate(getInvoiceCreateUrl());
    }, [readOnly, navigate]);
    const openInvoiceDetail = useCallback((id) => {
        navigate(getInvoiceDetailUrl(id, accountingEmbed ? { variant: 'accounting' } : undefined));
    }, [navigate, accountingEmbed]);
    const deleteInvoiceById = useCallback(async (inv) => {
        const isCanceled = inv.status === 'canceled';
        if (!await showConfirm({
            title: isCanceled
                ? t('timeTrackingPage.invoices.confirm.deleteCanceledTitle')
                : t('timeTrackingPage.invoices.confirm.deleteDraftTitle'),
            message: isCanceled
                ? t('timeTrackingPage.invoices.confirm.deleteCanceledMessage')
                : t('timeTrackingPage.invoices.confirm.deleteDraftMessage'),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.invoices.confirm.deleteConfirm'),
        }))
            return false;
        setActionBusy(true);
        try {
            await deleteDraftInvoice(inv.id);
            loadList();
            void loadAggStats();
            notifyReportsInvalidated();
            return true;
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
            return false;
        }
        finally {
            setActionBusy(false);
        }
    }, [loadAggStats, loadList, showAlert, showConfirm, t]);
    useEffect(() => {
        const oid = searchParams.get(OPEN_INVOICE_DETAIL_QUERY)?.trim();
        if (!oid)
            return;
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete(OPEN_INVOICE_DETAIL_QUERY);
            return p;
        }, { replace: true });
        navigate(getInvoiceDetailUrl(oid, accountingEmbed ? { variant: 'accounting' } : undefined), { replace: true });
    }, [searchParams, setSearchParams, navigate, accountingEmbed]);
    const INV_TAB_KEY = 'tt-inv-subtab';
    const invoicesSubTab = searchParams.get('invTab') === 'registry'
        ? 'registry'
        : searchParams.get('invTab') === 'statistics'
            ? 'statistics'
            : 'list';
    const selectInvoicesSubTab = useCallback((tab) => {
        try {
            window.sessionStorage.setItem(INV_TAB_KEY, tab);
        }
        catch {
            /* private mode */
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (tab === 'registry')
                next.set('invTab', 'registry');
            else if (tab === 'statistics')
                next.set('invTab', 'statistics');
            else
                next.delete('invTab');
            return next;
        }, { replace: true });
    }, [setSearchParams]);
    useEffect(() => {
        if (searchParams.get('invTab'))
            return;
        let saved = '';
        try {
            saved = window.sessionStorage.getItem(INV_TAB_KEY) ?? '';
        }
        catch {
            saved = '';
        }
        if (saved === 'registry' || saved === 'statistics')
            selectInvoicesSubTab(saved);
    }, [searchParams, selectInvoicesSubTab]);
    return (_jsxs("div", { className: `tt-inv${accountingEmbed ? ' tt-inv--accounting' : ''}`, children: [_jsxs("div", { className: "tt-reports__type-block", children: [!accountingEmbed && (_jsx("p", { className: "tt-reports__type-block-title", id: "tt-inv-page-title", children: t('timeTrackingPage.invoices.title') })), _jsxs("nav", { className: "tt-reports__type-nav", role: "tablist", "aria-labelledby": "tt-inv-page-title", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": invoicesSubTab === 'list', className: `tt-reports__type-tab${invoicesSubTab === 'list' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectInvoicesSubTab('list'), children: t('timeTrackingPage.invoices.tabs.list') }), _jsx("button", { type: "button", role: "tab", "aria-selected": invoicesSubTab === 'registry', className: `tt-reports__type-tab${invoicesSubTab === 'registry' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectInvoicesSubTab('registry'), children: t('timeTrackingPage.invoices.tabs.registry') }), _jsx("button", { type: "button", role: "tab", "aria-selected": invoicesSubTab === 'statistics', className: `tt-reports__type-tab${invoicesSubTab === 'statistics' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectInvoicesSubTab('statistics'), children: t('timeTrackingPage.invoices.tabs.statistics') })] }), invoicesSubTab === 'list' && (_jsxs("div", { className: "tt-inv__head-row", children: [_jsx("p", { className: "tt-inv__lede", id: accountingEmbed ? 'tt-inv-page-title' : undefined, children: accountingEmbed
                                    ? t('timeTrackingPage.invoices.introReadonly')
                                    : t('timeTrackingPage.invoices.introFull') }), !readOnly && (_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon", onClick: goToCreate, children: [_jsx(IcoPlus, {}), " ", t('timeTrackingPage.invoices.newInvoice')] })), readOnly && (_jsx("span", { className: "tt-inv__readonly-badge", role: "status", children: t('timeTrackingPage.invoices.readonlyBadge') }))] })), invoicesSubTab === 'registry' && (_jsx("p", { className: "tt-inv__lede", children: t('timeTrackingPage.invoices.registry.intro') })), invoicesSubTab === 'statistics' && (_jsx("p", { className: "tt-inv__lede", children: t('timeTrackingPage.invoices.statistics.intro') }))] }), invoicesSubTab === 'registry' ? (_jsx(InvoiceRegistryPanel, { readOnly: readOnly, variant: accountingEmbed ? 'accounting' : 'default' })) : invoicesSubTab === 'statistics' ? (_jsx(InvoiceRegistryStatisticsPanel, {})) : (_jsxs(_Fragment, { children: [!listErr && (aggStatsLoading || listStatsFromAgg) && (_jsx("div", { className: "tt-reports__summary", "aria-label": t('timeTrackingPage.invoices.summary.aria'), children: aggStatsLoading || !listStatsFromAgg ? (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-card--full", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.summary.label') }), _jsx("span", { className: "tt-reports__summary-value", style: { fontSize: '0.95rem' }, children: aggStatsLoading ? t('timeTrackingPage.common.loading') : '—' })] })) : (_jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.invoices.summary.drafts') }), _jsx("span", { className: "tt-reports__summary-value", children: listStatsFromAgg.drafts })] })) })), _jsxs("div", { className: "tt-reports__content", children: [_jsxs("div", { className: "tt-reports__content-header tt-inv__filter-header", children: [_jsxs("div", { className: "tt-reports__breakdown-bar-wrap", children: [_jsx("span", { className: "tt-reports__breakdown-label", children: t('timeTrackingPage.invoices.filters.listTitle') }), !listLoading && items.length > 0 && (_jsxs("span", { className: "tt-inv__list-hint", children: [t('timeTrackingPage.invoices.filters.pageHint').replace('{page}', String(invoiceListPage)).replace('{count}', String(items.length)), invoiceListTotalCount != null
                                                        ? t('timeTrackingPage.invoices.filters.totalKnown').replace('{total}', String(invoiceListTotalCount))
                                                        : items.length === INV_PAGE
                                                            ? t('timeTrackingPage.invoices.filters.totalUnknown')
                                                            : ''] }))] }), _jsxs("div", { className: "tt-reports__content-actions tt-inv__filter-actions", children: [!listErr && Object.keys(invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo)).length > 0 && (_jsx("p", { className: "tt-inv__list-hint tt-inv__billing-gate-hint", style: { width: '100%', flexBasis: '100%', margin: '0 0 0.35rem' }, children: t('timeTrackingPage.invoices.filters.billingGateHint') })), _jsxs("div", { className: "tt-reports__sort-wrap", children: [_jsx("label", { className: "tt-reports__sort-label", htmlFor: "tt-inv-filter-client-btn", children: t('timeTrackingPage.invoices.filters.client') }), _jsx(SearchableSelect, { className: "tsp-srch", buttonClassName: "tsp-srch__btn", buttonId: "tt-inv-filter-client-btn", portalDropdown: true, portalZIndex: 10050, portalMinWidth: 420, placeholder: t('timeTrackingPage.invoices.filters.client'), emptyListText: t('timeTrackingPage.common.noClients'), noMatchText: t('timeTrackingPage.common.notFound'), value: clientFilter, items: clientFilterSearchItems, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.name, getSearchText: (o) => o.search, onSelect: (o) => changeClientFilter(o.id), "aria-label": t('timeTrackingPage.invoices.filters.clientFilterAria') })] }), _jsxs("div", { className: "tt-reports__sort-wrap", children: [_jsx("label", { className: "tt-reports__sort-label", htmlFor: "tt-inv-filter-project-btn", children: t('timeTrackingPage.invoices.filters.project') }), _jsx(SearchableSelect, { className: "tsp-srch", buttonClassName: "tsp-srch__btn", buttonId: "tt-inv-filter-project-btn", portalDropdown: true, portalZIndex: 10050, portalMinWidth: 720, placeholder: t('timeTrackingPage.invoices.filters.allProjects'), emptyListText: t('timeTrackingPage.common.noProjects'), noMatchText: t('timeTrackingPage.common.notFound'), value: projectFilter, items: projectFilterSearchItems, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.name, getSearchText: (o) => o.search, onSelect: (o) => changeProjectFilter(o.id), "aria-label": t('timeTrackingPage.invoices.filters.projectFilterAria') })] }), _jsxs("div", { className: "tt-reports__sort-wrap tt-inv__filter-dates", children: [_jsx("span", { className: "tt-reports__sort-label", children: t('timeTrackingPage.invoices.filters.issueDate') }), _jsxs("div", { className: "tt-inv__filter-dates-row", children: [_jsx(DatePicker, { value: listDateFrom, max: listDateTo || undefined, onChange: changeListDateFrom, emptyLabel: t('timeTrackingPage.invoices.filters.dateEmpty'), portal: true, portalZIndex: 10050, buttonClassName: "tt-reports__date-picker-btn", title: t('timeTrackingPage.invoices.filters.issueDateFrom'), showChevron: true }), listDateFrom ? (_jsx("button", { type: "button", className: "tt-inv__date-clear", onClick: () => changeListDateFrom(''), "aria-label": t('timeTrackingPage.invoices.filters.clearDateFrom'), title: t('timeTrackingPage.invoices.filters.reset'), children: "\u00D7" })) : null, _jsx("span", { className: "tt-inv__date-sep", "aria-hidden": true, children: "\u2014" }), _jsx(DatePicker, { value: listDateTo, min: listDateFrom || undefined, onChange: changeListDateTo, emptyLabel: t('timeTrackingPage.invoices.filters.dateEmpty'), portal: true, portalZIndex: 10050, buttonClassName: "tt-reports__date-picker-btn", title: t('timeTrackingPage.invoices.filters.issueDateTo'), showChevron: true }), listDateTo ? (_jsx("button", { type: "button", className: "tt-inv__date-clear", onClick: () => changeListDateTo(''), "aria-label": t('timeTrackingPage.invoices.filters.clearDateTo'), title: t('timeTrackingPage.invoices.filters.reset'), children: "\u00D7" })) : null] })] }), _jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", onClick: () => {
                                                    loadList();
                                                    void loadAggStats();
                                                }, disabled: listLoading, title: t('timeTrackingPage.invoices.filters.refreshTitle'), children: [_jsx(IcoRefresh, {}), " ", t('timeTrackingPage.common.refresh')] })] })] }), _jsx("div", { className: "tt-reports__table-wrap tt-inv__table-outer", children: listLoading ? (accountingEmbed ? (_jsx("div", { className: "acct-inv-skel", role: "status", "aria-live": "polite", "aria-busy": "true", children: Array.from({ length: 8 }, (_, i) => _jsx("div", { className: "acct-skel acct-skel--row" }, i)) })) : (_jsxs("div", { className: "tt-inv__loading", role: "status", "aria-live": "polite", "aria-busy": "true", children: [_jsx("div", { className: "tt-inv__loading-spinner" }), _jsx("span", { children: t('timeTrackingPage.invoices.list.loading') })] }))) : items.length === 0 && partnerListBlocked ? (_jsxs("div", { className: "tt-inv__empty tt-inv__empty--gate", children: [_jsx(IcoInvoiceEmpty, {}), _jsx("h3", { className: "tt-inv__empty-title", children: t('timeTrackingPage.invoices.empty.gateTitle') }), _jsx("p", { className: "tt-inv__empty-text", children: t('timeTrackingPage.invoices.empty.gateText') }), _jsxs("p", { className: "tt-inv__empty-actions", children: [_jsx(Link, { className: "tt-reports__btn tt-reports__btn--outline", to: `${routes.timeTracking}?tab=reports`, children: t('timeTrackingPage.invoices.empty.reportsLink') }), projectFilter.trim() !== '' ? (_jsx(Link, { className: "tt-reports__btn tt-reports__btn--outline", to: getProjectDetailUrl(projectFilter.trim()), children: t('timeTrackingPage.invoices.empty.projectCardLink') })) : null, !readOnly && (_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon", onClick: goToCreate, children: [_jsx(IcoPlus, {}), " ", t('timeTrackingPage.invoices.newInvoice')] }))] })] })) : items.length === 0 ? (_jsxs("div", { className: "tt-inv__empty", children: [_jsx(IcoInvoiceEmpty, {}), _jsx("h3", { className: "tt-inv__empty-title", children: t('timeTrackingPage.invoices.empty.title') }), _jsx("p", { className: "tt-inv__empty-text", children: readOnly
                                                ? t('timeTrackingPage.invoices.empty.textReadonly')
                                                : t('timeTrackingPage.invoices.empty.textFull') }), !readOnly && (_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon", onClick: goToCreate, children: [_jsx(IcoPlus, {}), " ", t('timeTrackingPage.invoices.newInvoice')] })), readOnly && (_jsx(Link, { className: "tt-reports__btn tt-reports__btn--outline", to: routes.timeTracking, children: t('timeTrackingPage.invoices.empty.timeTrackingLink') }))] })) : (_jsxs("div", { className: "tt-inv__table-scroll", children: [_jsxs("table", { className: "tt-reports__table tt-inv__data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: t('timeTrackingPage.invoices.list.columns.number') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.invoices.list.columns.client') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.invoices.list.columns.issueDate') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.invoices.list.columns.dueDate') }), _jsx("th", { scope: "col", className: "tt-inv__th-num", children: t('timeTrackingPage.invoices.list.columns.amount') }), _jsx("th", { scope: "col", className: "tt-inv__th-num", children: t('timeTrackingPage.invoices.list.columns.balance') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.invoices.list.columns.status') }), _jsx("th", { scope: "col", className: "tt-inv__th-action", "aria-label": t('timeTrackingPage.invoices.list.columns.action') })] }) }), _jsx("tbody", { children: items.map((inv) => {
                                                        const badgeClass = INVOICE_STATUS_BADGE_CLASS[inv.status] ?? 'tt-inv__badge--neutral';
                                                        const canDelete = !readOnly && invoiceCanDeleteDraft(inv.status);
                                                        return (_jsxs("tr", { className: "tt-inv__row", tabIndex: 0, onClick: () => openInvoiceDetail(inv.id), onKeyDown: (e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    openInvoiceDetail(inv.id);
                                                                }
                                                            }, children: [_jsx("td", { className: "tt-inv__td-strong", children: inv.invoiceNumber }), _jsx("td", { children: clientNameById.get(inv.clientId) ?? inv.clientId }), _jsx("td", { children: fmtDisplayDate(inv.issueDate, locale) }), _jsx("td", { children: fmtDisplayDate(inv.dueDate, locale) }), _jsx("td", { className: "tt-inv__td-num", children: fmtMoney(inv.totalAmount, inv.currency, locale) }), _jsx("td", { className: "tt-inv__td-num", children: fmtMoney(inv.balanceDue, inv.currency, locale) }), _jsx("td", { children: _jsx("span", { className: `tt-inv__badge ${badgeClass}`, children: ttInvoiceStatusLabel(inv.status, t) }) }), _jsx("td", { className: "tt-inv__td-action", children: _jsxs("div", { className: "tt-inv__row-actions", children: [canDelete ? (_jsx("button", { type: "button", className: "tt-inv__row-delete", disabled: actionBusy, title: inv.status === 'canceled'
                                                                                    ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                                                                                    : t('timeTrackingPage.invoices.detail.deleteDraft'), "aria-label": inv.status === 'canceled'
                                                                                    ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                                                                                    : t('timeTrackingPage.invoices.detail.deleteDraft'), onClick: (e) => {
                                                                                    e.stopPropagation();
                                                                                    void deleteInvoiceById(inv);
                                                                                }, children: _jsx(IcoTrash, {}) })) : null, _jsx("span", { className: "tt-inv__row-cta", "aria-hidden": true, children: _jsx(IcoChevRight, {}) })] }) })] }, inv.id));
                                                    }) })] }), showInvoicePager && (_jsxs("div", { className: "tt-list-pagination tt-inv__list-pager", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline", disabled: listLoading || invoiceListPage <= 1, onClick: () => setInvoiceListPage((p) => Math.max(1, p - 1)), children: t('timeTrackingPage.timesheet.back') }), _jsx("span", { className: "tt-list-pagination__meta", children: t('timeTrackingPage.invoices.list.pageLabel').replace('{page}', String(invoiceListPage)) }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--outline", disabled: invoiceNextDisabled, onClick: () => setInvoiceListPage((p) => p + 1), children: t('timeTrackingPage.timesheet.forward') })] }))] })) })] })] }))] }));
}
