import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { archiveCorrespondence, correspondenceErrorMessage, deleteCorrespondence, fetchCorrespondenceDocument, fetchCorrespondenceStats, invalidateCorrespondencePartnerAttention, listCorrespondence, mapDocumentToCorrRow, downloadCorrespondenceAttachment, registerIncomingCorrespondence, registerOutgoingCorrespondence, CORR_DOC_TYPE_KEYS, } from '@entities/correspondence';
import { routes } from '@shared/config';
import { AttentionBanner, formatCountBadge, showAlert, showConfirm, showToast, DatePicker, SearchableSelect } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { canDeleteCorrespondence } from '../model/permissions';
import { getUsers, listPartners } from '@entities/user';
import { compareRuLabels, userPickerSortLabel } from '@shared/lib/sortByRuLabel';
import { CORR_COUNTERPARTY_COLUMN, CORR_PAGE_SIZE, CORR_SHELL_NAV_TABS, CORR_STATUS_BADGE, CORR_TABLE_TABS, CORR_TYPE_BADGE, allCorrDocTypesSelected, defaultCorrDocTypeFilterState, } from '../model/constants';
import { CorrespondenceDocumentCardModal } from './CorrespondenceDocumentCardModal';
import { CorrespondenceRegisterIncomingModal } from './CorrespondenceRegisterIncomingModal';
import { CorrespondenceRegisterOutgoingModal } from './CorrespondenceRegisterOutgoingModal';
import { CorrespondenceRegistrySkeleton } from './CorrespondenceSkeleton';
import { CorrespondenceShell } from './CorrespondenceShell';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';
function StatIcon({ name }) {
    if (name === 'inbox') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }), _jsx("path", { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" })] }));
    }
    if (name === 'send') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }));
    }
    if (name === 'users') {
        return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }), _jsx("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })] }));
    }
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }));
}
function ScanIcon({ attached }) {
    return (_jsx("span", { className: `corr__scan-icon${attached ? '' : ' corr__scan-icon--missing'}`, title: attached ? 'Скан приложен' : 'Скан отсутствует', "aria-hidden": true, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), attached ? _jsx("polyline", { points: "9 15 11 17 15 13" }) : _jsx("line", { x1: "9", y1: "9", x2: "15", y2: "15" })] }) }));
}
function buildPageNumbers(page, totalPages) {
    if (totalPages <= 7)
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set();
    set.add(1);
    set.add(totalPages);
    set.add(page);
    for (let d = -1; d <= 1; d++) {
        const p = page + d;
        if (p >= 1 && p <= totalPages)
            set.add(p);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const n of sorted) {
        if (prev > 0 && n - prev > 1)
            out.push('ellipsis');
        out.push(n);
        prev = n;
    }
    return out;
}
function userFilterLabel(u) {
    return u.display_name?.trim() || u.email || `User #${u.id}`;
}
const EMPTY_EXTRA_FILTERS = {
    partnerUserId: null,
    responsibleUserId: null,
    dateFrom: '',
    dateTo: '',
    q: '',
};
function listParamsForTab(direction, tableTab, page, docTypes, extra, attentionPartnerUserId) {
    const params = {
        direction,
        skip: (page - 1) * CORR_PAGE_SIZE,
        limit: CORR_PAGE_SIZE,
    };
    if (tableTab === 'attention' && attentionPartnerUserId != null && attentionPartnerUserId > 0) {
        params.partnerUserId = attentionPartnerUserId;
        params.status = direction === 'outgoing' ? 'pending_review' : 'new,progress,approval';
    }
    else if (tableTab === 'work')
        params.statusGroup = 'work';
    else if (tableTab === 'awaiting_signature')
        params.status = 'awaiting_signature';
    else if (tableTab === 'done')
        params.status = 'done';
    if (tableTab !== 'attention' && extra.partnerUserId != null && extra.partnerUserId > 0)
        params.partnerUserId = extra.partnerUserId;
    if (extra.responsibleUserId != null && extra.responsibleUserId > 0)
        params.responsibleUserId = extra.responsibleUserId;
    if (extra.dateFrom)
        params.dateFrom = extra.dateFrom;
    if (extra.dateTo)
        params.dateTo = extra.dateTo;
    if (extra.q.trim())
        params.q = extra.q.trim();
    if (docTypes.length > 0 && !allCorrDocTypesSelected(docTypes))
        params.docType = docTypes;
    return params;
}
function usePopoverBelowAnchor(open, anchorRef, opts) {
    const { align, gap, minWidth } = opts;
    const [box, setBox] = useState(null);
    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        const anchor = anchorRef.current;
        if (!anchor) {
            setBox(null);
            return;
        }
        const update = () => {
            const r = anchor.getBoundingClientRect();
            let left = align === 'start' ? r.left : r.right - minWidth;
            left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8));
            setBox({ top: r.bottom + gap, left, minWidth });
        };
        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open, anchorRef, align, gap, minWidth]);
    return box;
}
const EMPTY_STATS = {
    incomingTotal: 0,
    outgoingTotal: 0,
    approvalTotal: 0,
    incomingNewTotal: 0,
    pendingReviewTotal: 0,
    partnerAttentionTotal: 0,
    partnerOutgoingPending: 0,
    partnerIncomingNew: 0,
};
export function CorrespondenceRegistryView({ direction, onDirectionChange, initialTableTab, }) {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const isPartner = isPartnerOrgRole(user?.role, user?.position);
    const canDelete = canDeleteCorrespondence(user?.role, user?.position);
    const navigate = useNavigate();
    const [tableTab, setTableTab] = useState(() => {
        const initial = initialTableTab ?? 'all';
        if (initial === 'attention' && !(isPartnerOrgRole(user?.role, user?.position)))
            return 'all';
        return initial;
    });
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [listLoading, setListLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const [stats, setStats] = useState(EMPTY_STATS);
    const [reloadToken, setReloadToken] = useState(0);
    const [filterDraft, setFilterDraft] = useState(defaultCorrDocTypeFilterState);
    const [appliedDocTypes, setAppliedDocTypes] = useState([...CORR_DOC_TYPE_KEYS]);
    const [extraFilters, setExtraFilters] = useState(EMPTY_EXTRA_FILTERS);
    const [extraDraft, setExtraDraft] = useState(EMPTY_EXTRA_FILTERS);
    const [searchText, setSearchText] = useState('');
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [userOptions, setUserOptions] = useState([]);
    const [usersFilterAvailable, setUsersFilterAvailable] = useState(true);
    useEffect(() => {
        if (tableTab === 'attention' && (!isPartner || (direction !== 'outgoing' && direction !== 'incoming')))
            setTableTab('all');
    }, [tableTab, isPartner, direction]);
    const totalPages = Math.max(1, Math.ceil(total / CORR_PAGE_SIZE));
    const effectivePage = Math.min(page, totalPages);
    const pageNumbers = useMemo(() => buildPageNumbers(effectivePage, totalPages), [effectivePage, totalPages]);
    const rangeStart = total === 0 ? 0 : (effectivePage - 1) * CORR_PAGE_SIZE + 1;
    const rangeEnd = total === 0 ? 0 : Math.min(effectivePage * CORR_PAGE_SIZE, total);
    const counterpartyColumn = CORR_COUNTERPARTY_COLUMN[direction];
    const statCards = useMemo(() => ([
        {
            key: 'in',
            label: 'Входящие',
            value: String(stats.incomingTotal),
            delta: 'в реестре',
            deltaVariant: 'blue',
            icon: 'inbox',
            active: direction === 'incoming' && tableTab === 'all',
            actionLabel: 'Показать входящие',
        },
        {
            key: 'out',
            label: 'Исходящие',
            value: String(stats.outgoingTotal),
            delta: 'в реестре',
            deltaVariant: 'green',
            icon: 'send',
            active: direction === 'outgoing' && tableTab === 'all',
            actionLabel: 'Показать исходящие',
        },
        {
            key: 'approval',
            label: 'На согласовании',
            value: String(stats.approvalTotal),
            delta: 'активные',
            deltaVariant: 'orange',
            icon: 'users',
            active: direction === 'outgoing' && tableTab === 'work',
            actionLabel: 'Показать документы на согласовании',
        },
        {
            key: 'overdue',
            label: 'На согласовании',
            value: String(stats.pendingReviewTotal),
            delta: 'ожидают партнёра',
            deltaVariant: 'red',
            icon: 'clock',
            active: direction === 'outgoing' && tableTab === 'attention',
            actionLabel: 'Показать письма на согласовании',
        },
    ]), [stats, direction, tableTab]);
    const reloadAll = useCallback(() => {
        setReloadToken((t) => t + 1);
    }, []);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setStatsLoading(true);
        void fetchCorrespondenceStats(controller.signal)
            .then((s) => {
            if (!cancelled)
                setStats(s);
        })
            .catch(() => {
            if (!cancelled)
                setStats(EMPTY_STATS);
        })
            .finally(() => {
            if (!cancelled)
                setStatsLoading(false);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [reloadToken]);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setListLoading(true);
        setListError(null);
        const params = listParamsForTab(direction, tableTab, effectivePage, appliedDocTypes, extraFilters, user?.id);
        void listCorrespondence(params, controller.signal)
            .then((res) => {
            if (cancelled)
                return;
            setRows(res.items.map(mapDocumentToCorrRow));
            setTotal(res.total);
        })
            .catch((err) => {
            if (cancelled)
                return;
            setRows([]);
            setTotal(0);
            setListError(correspondenceErrorMessage(err, 'Не удалось загрузить реестр'));
        })
            .finally(() => {
            if (!cancelled)
                setListLoading(false);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [direction, tableTab, effectivePage, appliedDocTypes, extraFilters, reloadToken, user?.id]);
    const filtersBtnRef = useRef(null);
    const settingsBtnRef = useRef(null);
    const rowMenuBtnRef = useRef(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [rowMenuOpenId, setRowMenuOpenId] = useState(null);
    const [incomingModalOpen, setIncomingModalOpen] = useState(false);
    const [outgoingModalOpen, setOutgoingModalOpen] = useState(false);
    const [registerPending, setRegisterPending] = useState(false);
    const [cardDocId, setCardDocId] = useState(null);
    const filterPopoverBox = usePopoverBelowAnchor(filtersOpen, filtersBtnRef, { align: 'start', gap: 6, minWidth: 360 });
    const settingsPopoverBox = usePopoverBelowAnchor(settingsOpen, settingsBtnRef, { align: 'end', gap: 6, minWidth: 200 });
    const rowMenuPopoverBox = usePopoverBelowAnchor(rowMenuOpenId !== null, rowMenuBtnRef, { align: 'end', gap: 6, minWidth: 200 });
    const closeOverlays = useCallback(() => {
        setFiltersOpen(false);
        setSettingsOpen(false);
        setRowMenuOpenId(null);
    }, []);
    useEffect(() => {
        if (!filtersOpen)
            return;
        let cancelled = false;
        void listPartners()
            .then((rows) => {
            if (!cancelled)
                setPartnerOptions(rows);
        })
            .catch(() => {
            if (!cancelled)
                setPartnerOptions([]);
        });
        void getUsers(false)
            .then((rows) => {
            if (cancelled)
                return;
            setUsersFilterAvailable(true);
            setUserOptions([...rows].sort((a, b) => compareRuLabels(userPickerSortLabel(a), userPickerSortLabel(b))));
        })
            .catch(() => {
            if (cancelled)
                return;
            setUsersFilterAvailable(false);
            setUserOptions([]);
        });
        return () => {
            cancelled = true;
        };
    }, [filtersOpen]);
    const handleStatCardClick = useCallback((key) => {
        closeOverlays();
        setPage(1);
        if (key === 'in') {
            onDirectionChange('incoming');
            setTableTab('all');
            return;
        }
        if (key === 'out') {
            onDirectionChange('outgoing');
            setTableTab('all');
            return;
        }
        if (key === 'approval') {
            onDirectionChange('outgoing');
            setTableTab('work');
            return;
        }
        onDirectionChange('outgoing');
        setTableTab(isPartner ? 'attention' : 'work');
    }, [closeOverlays, isPartner, onDirectionChange]);
    useEffect(() => {
        if (!filtersOpen && !settingsOpen && !rowMenuOpenId)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeOverlays();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [filtersOpen, settingsOpen, rowMenuOpenId, closeOverlays]);
    const rowMenuRow = useMemo(() => (rowMenuOpenId ? rows.find((r) => r.id === rowMenuOpenId) ?? null : null), [rows, rowMenuOpenId]);
    const applyTypeFilters = useCallback(() => {
        const selected = CORR_DOC_TYPE_KEYS.filter((k) => filterDraft[k]);
        if (selected.length === 0) {
            void showAlert({ title: 'Фильтры', message: 'Выберите хотя бы один тип документа.' });
            return;
        }
        if (extraDraft.dateFrom && extraDraft.dateTo && extraDraft.dateFrom > extraDraft.dateTo) {
            void showAlert({ title: 'Фильтры', message: 'Дата «с» не может быть позже даты «по».' });
            return;
        }
        setAppliedDocTypes([...selected]);
        setExtraFilters({
            ...extraDraft,
            q: searchText.trim(),
        });
        setPage(1);
        setFiltersOpen(false);
    }, [extraDraft, filterDraft, searchText]);
    const resetFilters = useCallback(() => {
        setFilterDraft(defaultCorrDocTypeFilterState());
        setExtraDraft(EMPTY_EXTRA_FILTERS);
        setSearchText('');
        setAppliedDocTypes([...CORR_DOC_TYPE_KEYS]);
        setExtraFilters(EMPTY_EXTRA_FILTERS);
        setPage(1);
        setFiltersOpen(false);
    }, []);
    useEffect(() => {
        const next = searchText.trim();
        const handle = window.setTimeout(() => {
            setExtraFilters((prev) => (prev.q === next ? prev : { ...prev, q: next }));
        }, 300);
        return () => window.clearTimeout(handle);
    }, [searchText]);
    const appliedSearch = extraFilters.q;
    const skipSearchPageReset = useRef(true);
    useEffect(() => {
        if (skipSearchPageReset.current) {
            skipSearchPageReset.current = false;
            return;
        }
        setPage(1);
    }, [appliedSearch]);
    const extraFilterCount = useMemo(() => {
        let n = 0;
        if (appliedDocTypes.length < 3)
            n += 1;
        if (extraFilters.partnerUserId != null)
            n += 1;
        if (extraFilters.responsibleUserId != null)
            n += 1;
        if (extraFilters.dateFrom || extraFilters.dateTo)
            n += 1;
        return n;
    }, [appliedDocTypes, extraFilters]);
    const partnerSelectItems = useMemo(() => [
        { id: 0, label: 'Все партнёры' },
        ...partnerOptions.map((p) => ({ id: p.id, label: userFilterLabel(p) })),
    ], [partnerOptions]);
    const userSelectItems = useMemo(() => [
        { id: 0, label: 'Все пользователи' },
        ...userOptions.map((u) => ({ id: u.id, label: userFilterLabel(u) })),
    ], [userOptions]);
    const openComposeLetter = () => {
        closeOverlays();
        navigate(routes.correspondenceOutgoingCreate);
    };
    const openRegisterModal = () => {
        closeOverlays();
        if (direction === 'incoming')
            setIncomingModalOpen(true);
        else
            setOutgoingModalOpen(true);
    };
    const handleIncomingSubmit = async (payload) => {
        setRegisterPending(true);
        try {
            await registerIncomingCorrespondence({
                partnerUserId: payload.partnerUserId,
                counterparty: payload.counterparty,
                subject: payload.subject,
                docType: payload.type,
                comment: payload.comment,
                scanFiles: payload.scanFiles,
            });
            setIncomingModalOpen(false);
            invalidateCorrespondencePartnerAttention();
            reloadAll();
            void showAlert({
                title: 'Входящее сохранено',
                message: `Письмо зарегистрировано для партнёра «${payload.partnerName}».`,
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось сохранить',
                message: correspondenceErrorMessage(err, 'Ошибка регистрации'),
            });
        }
        finally {
            setRegisterPending(false);
        }
    };
    const handleOutgoingSubmit = async (payload) => {
        setRegisterPending(true);
        try {
            await registerOutgoingCorrespondence({
                counterparty: payload.counterparty,
                subject: payload.subject,
                docType: payload.type,
                comment: payload.comment,
                attachmentFiles: payload.attachmentFiles,
            });
            setOutgoingModalOpen(false);
            invalidateCorrespondencePartnerAttention();
            reloadAll();
            void showAlert({
                title: 'Исходящее сохранено',
                message: `Документ для «${payload.counterparty}» зарегистрирован в реестре.`,
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось сохранить',
                message: correspondenceErrorMessage(err, 'Ошибка регистрации'),
            });
        }
        finally {
            setRegisterPending(false);
        }
    };
    const viewScan = (row) => {
        setRowMenuOpenId(null);
        setCardDocId(row.id);
    };
    const downloadAttachment = async (row) => {
        setRowMenuOpenId(null);
        try {
            const doc = await fetchCorrespondenceDocument(row.id);
            const file = doc.attachments?.find((a) => a.attachmentKind === 'scan')
                ?? doc.attachments?.find((a) => a.attachmentKind === 'attachment')
                ?? doc.attachments?.[0];
            if (!file) {
                void showAlert({ title: 'Вложения', message: 'У документа нет файлов для скачивания.' });
                return;
            }
            await downloadCorrespondenceAttachment(row.id, file.id, file.fileName);
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось скачать файл',
                message: err instanceof Error ? err.message : 'Ошибка загрузки',
            });
        }
    };
    const archiveRow = async (row) => {
        setRowMenuOpenId(null);
        try {
            await archiveCorrespondence(row.id);
            reloadAll();
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось архивировать',
                message: err instanceof Error ? err.message : 'Ошибка',
            });
        }
    };
    const deleteRow = async (row) => {
        setRowMenuOpenId(null);
        const label = row.registryNumber.trim() || row.subject.trim() || 'документ';
        const ok = await showConfirm({
            title: 'Удалить документ?',
            message: `«${label}» будет удалён вместе с файлами. Это нельзя отменить.`,
            confirmLabel: 'Удалить',
            cancelLabel: 'Отмена',
            variant: 'danger',
        });
        if (!ok)
            return;
        try {
            await deleteCorrespondence(row.id);
            if (cardDocId === row.id)
                setCardDocId(null);
            invalidateCorrespondencePartnerAttention();
            reloadAll();
            showToast({ message: 'Документ удалён', variant: 'success' });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось удалить',
                message: correspondenceErrorMessage(err, 'Ошибка удаления'),
            });
        }
    };
    const outgoingBadge = formatCountBadge(stats.partnerOutgoingPending);
    const incomingBadge = formatCountBadge(stats.partnerIncomingNew);
    const attentionCountForDirection = direction === 'outgoing'
        ? stats.partnerOutgoingPending
        : stats.partnerIncomingNew;
    const attentionBadge = formatCountBadge(attentionCountForDirection);
    const shellTabs = useMemo(() => CORR_SHELL_NAV_TABS.map((tab) => ({
        id: tab.key,
        label: tab.label,
        active: direction === tab.key,
        badge: tab.key === 'outgoing'
            ? outgoingBadge || undefined
            : tab.key === 'incoming'
                ? incomingBadge || undefined
                : undefined,
        onClick: () => {
            closeOverlays();
            onDirectionChange(tab.key);
            const nextCount = tab.key === 'outgoing'
                ? stats.partnerOutgoingPending
                : stats.partnerIncomingNew;
            setTableTab(nextCount > 0 ? 'attention' : 'all');
            setPage(1);
        },
    })), [
        closeOverlays,
        direction,
        onDirectionChange,
        outgoingBadge,
        incomingBadge,
        stats.partnerOutgoingPending,
        stats.partnerIncomingNew,
    ]);
    const activeShellTab = CORR_SHELL_NAV_TABS.find((tab) => tab.key === direction)?.label ?? 'Входящие';
    const showRegistrySkeleton = listLoading && rows.length === 0 && !listError;
    const tablePanelKey = `${direction}-${tableTab}-${effectivePage}`;
    return (_jsxs(CorrespondenceShell, { activeTab: activeShellTab, tabs: shellTabs, fullHeight: true, contentClassName: "corr-shell__content--registry", children: [isPartner && attentionCountForDirection > 0 && tableTab !== 'attention' ? (_jsx(AttentionBanner, { className: "corr-registry__attention", text: (direction === 'outgoing'
                    ? t('attentionBanner.correspondenceOutgoing')
                    : t('attentionBanner.correspondenceIncoming')).replace('{count}', String(attentionCountForDirection)), actionLabel: t('attentionBanner.correspondenceGo'), onAction: () => {
                    setTableTab('attention');
                    setPage(1);
                } })) : isPartner && direction === 'incoming' && stats.partnerOutgoingPending > 0 ? (_jsx(AttentionBanner, { className: "corr-registry__attention", text: t('attentionBanner.correspondenceOutgoing').replace('{count}', String(stats.partnerOutgoingPending)), actionLabel: t('attentionBanner.correspondenceGo'), onAction: () => {
                    onDirectionChange('outgoing');
                    setTableTab('attention');
                    setPage(1);
                } })) : isPartner && direction === 'outgoing' && stats.partnerIncomingNew > 0 ? (_jsx(AttentionBanner, { className: "corr-registry__attention", text: t('attentionBanner.correspondenceIncoming').replace('{count}', String(stats.partnerIncomingNew)), actionLabel: t('attentionBanner.correspondenceGo'), onAction: () => {
                    onDirectionChange('incoming');
                    setTableTab('attention');
                    setPage(1);
                } })) : null, _jsx("div", { className: "corr-registry corr-registry--enter", children: _jsxs("div", { className: "corr__body corr-registry__layout", children: [_jsx("aside", { className: "corr-registry__sidebar", "aria-label": "\u0411\u043E\u043A\u043E\u0432\u0430\u044F \u043F\u0430\u043D\u0435\u043B\u044C", children: _jsxs("div", { className: "corr-registry__sidebar-inner", children: [_jsx("p", { className: "corr-registry__sidebar-label", children: "\u0411\u044B\u0441\u0442\u0440\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F" }), direction === 'outgoing' ? (_jsxs("div", { className: "corr-registry__cta-stack", children: [_jsxs("button", { type: "button", className: "corr__btn corr__btn--primary corr__btn--block corr-registry__cta", onClick: openComposeLetter, children: [_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), _jsx("polyline", { points: "22,6 12,13 2,6" })] }), "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043F\u0438\u0441\u044C\u043C\u043E"] }), _jsxs("button", { type: "button", className: "corr__btn corr__btn--outline corr__btn--block corr-registry__cta corr-registry__cta--secondary", onClick: openRegisterModal, children: [_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }), "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u044F\u0449\u0435\u0435"] })] })) : (_jsxs("button", { type: "button", className: "corr__btn corr__btn--primary corr__btn--block corr-registry__cta", onClick: openRegisterModal, children: [_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "12", y1: "18", x2: "12", y2: "12" }), _jsx("line", { x1: "9", y1: "15", x2: "15", y2: "15" })] }), "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0445\u043E\u0434\u044F\u0449\u0435\u0435"] })), _jsx("p", { className: "corr-registry__sidebar-note", children: direction === 'incoming'
                                            ? 'Для входящих обязательны партнёр и файл скана или фото документа.'
                                            : '«Написать письмо» открывает редактор бланка в браузере. Готовый документ можно отправить партнёру на согласование.' })] }) }), _jsx("div", { className: "corr__content corr__content--registry corr-registry__main", role: "tabpanel", children: showRegistrySkeleton ? (_jsx(CorrespondenceRegistrySkeleton, { rows: CORR_PAGE_SIZE })) : (_jsxs(_Fragment, { children: [_jsx("section", { className: "corr__stats corr-registry__stats", "aria-label": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438", children: statCards.map((s, i) => (_jsxs("button", { type: "button", className: `corr__stat corr__stat--clickable corr__stat--${s.deltaVariant}${s.active ? ' corr__stat--active' : ''}${statsLoading ? ' corr__stat--dim' : ''}`, style: { '--corr-stagger': i }, "aria-pressed": s.active, "aria-label": `${s.actionLabel}: ${s.value}`, disabled: statsLoading, onClick: () => handleStatCardClick(s.key), children: [_jsx("div", { className: `corr__stat-icon-wrap corr__stat-icon-wrap--${s.deltaVariant}`, children: _jsx(StatIcon, { name: s.icon }) }), _jsxs("div", { className: "corr__stat-body", children: [_jsx("span", { className: "corr__stat-label", children: s.label }), _jsx("span", { className: "corr__stat-value", children: s.value }), _jsx("span", { className: "corr__stat-delta", children: s.delta })] })] }, s.key))) }), _jsxs("section", { className: "corr__table-card corr-registry__table-card", "aria-label": "\u0420\u0435\u0435\u0441\u0442\u0440 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432", children: [_jsxs("div", { className: "corr__table-toolbar", children: [_jsx("div", { className: "corr__table-tabs", role: "tablist", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u0443", children: CORR_TABLE_TABS.filter((tab) => tab.key !== 'attention' || (isPartner && (direction === 'outgoing' || direction === 'incoming'))).map((tabItem) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tableTab === tabItem.key, className: `corr__table-tab${tableTab === tabItem.key ? ' corr__table-tab--active' : ''}`, disabled: listLoading, onClick: () => {
                                                                closeOverlays();
                                                                setTableTab(tabItem.key);
                                                                setPage(1);
                                                            }, children: _jsxs("span", { className: "corr__table-tab-inner", children: [tabItem.label, tabItem.key === 'attention' && attentionBadge ? (_jsx("span", { className: "app-count-badge", "aria-hidden": true, children: attentionBadge })) : null] }) }, tabItem.key))) }), _jsxs("div", { className: "corr__table-actions", children: [_jsxs("label", { className: "corr-registry__search", children: [_jsxs("svg", { className: "corr-registry__search-icon", viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("line", { x1: "16.5", y1: "16.5", x2: "21", y2: "21" })] }), _jsx("input", { type: "search", className: "corr-modal__input corr-registry__search-input", value: searchText, onChange: (e) => setSearchText(e.target.value), placeholder: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044C, \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044C, \u0442\u0435\u043C\u0430, \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439\u2026", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0440\u0435\u0435\u0441\u0442\u0440\u0443", disabled: listLoading && rows.length === 0 })] }), _jsx("div", { className: "corr__anchor-wrap", children: _jsxs("button", { ref: filtersBtnRef, type: "button", className: `corr__btn corr__btn--outline${filtersOpen ? ' corr__btn--pressed' : ''}${extraFilterCount > 0 ? ' corr__btn--filter-on' : ''}`, "aria-expanded": filtersOpen, "aria-haspopup": "dialog", onClick: () => {
                                                                        setFilterDraft(Object.fromEntries(CORR_DOC_TYPE_KEYS.map((key) => [key, appliedDocTypes.includes(key)])));
                                                                        setExtraDraft(extraFilters);
                                                                        setFiltersOpen((v) => !v);
                                                                        setSettingsOpen(false);
                                                                        setRowMenuOpenId(null);
                                                                    }, children: ["\u0424\u0438\u043B\u044C\u0442\u0440\u044B", extraFilterCount > 0 ? (_jsx("span", { className: "app-count-badge", "aria-hidden": true, children: extraFilterCount })) : null, _jsx("svg", { className: "corr__btn-chevron", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }) }), _jsx("div", { className: "corr__anchor-wrap", children: _jsx("button", { ref: settingsBtnRef, type: "button", className: `corr__icon-btn${settingsOpen ? ' corr__icon-btn--open' : ''}`, title: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E", "aria-label": "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E", "aria-expanded": settingsOpen, "aria-haspopup": "menu", onClick: () => {
                                                                        setSettingsOpen((v) => !v);
                                                                        setFiltersOpen(false);
                                                                        setRowMenuOpenId(null);
                                                                    }, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" })] }) }) })] })] }), listError ? _jsx("p", { className: "corr__load-err", role: "alert", children: listError }) : null, _jsxs("div", { className: `corr-registry__table-panel${listLoading ? ' corr-registry__table-panel--loading' : ''}`, children: [listLoading && rows.length > 0 ? (_jsx("p", { className: "corr__load-hint corr-registry__load-overlay", "aria-live": "polite", children: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u2026" })) : null, _jsx("div", { className: "corr__table-scroll", children: _jsxs("table", { className: "corr__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "\u2116" }), _jsx("th", { scope: "col", children: counterpartyColumn }), _jsx("th", { scope: "col", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440" }), _jsx("th", { scope: "col", children: "\u0422\u0435\u043C\u0430" }), _jsx("th", { scope: "col", children: "\u0422\u0438\u043F" }), direction === 'incoming' ? _jsx("th", { scope: "col", children: "\u0421\u043A\u0430\u043D" }) : null, _jsx("th", { scope: "col", children: "\u0414\u0430\u0442\u0430" }), _jsx("th", { scope: "col", children: "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439" }), _jsx("th", { scope: "col", children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("th", { scope: "col", className: "corr__th-actions", children: _jsx("span", { className: "corr__sr-only", children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" }) })] }) }), _jsx("tbody", { children: !listLoading && rows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: direction === 'incoming' ? 10 : 9, className: "corr__table-empty", children: _jsxs("div", { className: "corr-registry__empty", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }), _jsx("p", { children: "\u041D\u0435\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432 \u0434\u043B\u044F \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F" })] }) }) })) : rows.map((row, rowIdx) => (_jsxs("tr", { className: "corr-registry__row corr-registry__row--clickable", style: { '--corr-stagger': rowIdx }, tabIndex: 0, role: "link", "aria-label": `Открыть карточку ${row.registryNumber}: ${row.subject}`, onClick: () => {
                                                                            closeOverlays();
                                                                            setCardDocId(row.id);
                                                                        }, onKeyDown: (e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.preventDefault();
                                                                                closeOverlays();
                                                                                setCardDocId(row.id);
                                                                            }
                                                                        }, children: [_jsx("td", { className: "corr__mono", children: row.registryNumber }), _jsx("td", { className: "corr-registry__cell-clip", children: row.counterparty }), _jsx("td", { children: row.partnerName
                                                                                    ? _jsx("span", { className: "corr__partner-pill", title: row.partnerUserId ? `Партнёр #${row.partnerUserId}` : undefined, children: row.partnerName })
                                                                                    : '—' }), _jsx("td", { className: "corr-registry__cell-subject", title: row.subject, children: _jsxs("span", { className: "corr-registry__subject-wrap", children: [_jsx("span", { className: "corr-registry__subject-text", children: row.subject }), (row.commentsCount ?? 0) > 0 ? (_jsxs("span", { className: "corr-registry__comments-badge", title: `Комментарии: ${row.commentsCount}`, "aria-label": `Комментарии: ${row.commentsCount}`, children: [_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }), row.commentsCount] })) : null] }) }), _jsx("td", { children: _jsx("span", { className: CORR_TYPE_BADGE[row.type].className, children: CORR_TYPE_BADGE[row.type].label }) }), direction === 'incoming' ? (_jsx("td", { children: _jsx(ScanIcon, { attached: Boolean(row.hasScan) }) })) : null, _jsx("td", { className: "corr__nowrap", children: row.date }), _jsx("td", { children: row.responsible }), _jsx("td", { children: _jsx("span", { className: CORR_STATUS_BADGE[row.status].className, children: CORR_STATUS_BADGE[row.status].label }) }), _jsx("td", { className: "corr__td-actions", children: _jsx("button", { ref: row.id === rowMenuOpenId ? rowMenuBtnRef : undefined, type: "button", className: `corr__row-menu${rowMenuOpenId === row.id ? ' corr__row-menu--open' : ''}`, "aria-expanded": rowMenuOpenId === row.id, "aria-haspopup": "menu", "aria-label": `Действия для ${row.registryNumber}`, onClick: (e) => {
                                                                                        e.stopPropagation();
                                                                                        setRowMenuOpenId((id) => (id === row.id ? null : row.id));
                                                                                        setFiltersOpen(false);
                                                                                        setSettingsOpen(false);
                                                                                    }, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", width: "18", height: "18", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "5", r: "2" }), _jsx("circle", { cx: "12", cy: "12", r: "2" }), _jsx("circle", { cx: "12", cy: "19", r: "2" })] }) }) })] }, row.id))) })] }) }), _jsxs("footer", { className: "corr__pagination", children: [_jsxs("span", { className: "corr__pagination-range", children: ["\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ", rangeStart, "\u2013", rangeEnd, " \u0438\u0437 ", total] }), total > 0 ? (_jsxs("nav", { className: "corr__pagination-nav", "aria-label": "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B", children: [_jsx("button", { type: "button", className: "corr__page-btn", disabled: effectivePage <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)), "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "15 18 9 12 15 6" }) }) }), pageNumbers.map((item, idx) => item === 'ellipsis'
                                                                        ? (_jsx("span", { className: "corr__page-ellipsis", children: "\u2026" }, `e-${idx}`))
                                                                        : (_jsx("button", { type: "button", className: `corr__page-num${item === effectivePage ? ' corr__page-num--active' : ''}`, onClick: () => setPage(item), "aria-current": item === effectivePage ? 'page' : undefined, children: item }, item))), _jsx("button", { type: "button", className: "corr__page-btn", disabled: effectivePage >= totalPages, onClick: () => setPage((p) => Math.min(totalPages, p + 1)), "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "9 18 15 12 9 6" }) }) })] })) : null] })] }, tablePanelKey)] })] })) })] }) }), filtersOpen && filterPopoverBox ? createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: "corr__popover-backdrop corr__popover-backdrop--enter", onClick: closeOverlays, "aria-hidden": true }), _jsxs("div", { className: "corr__popover corr__popover--filters corr__popover--enter", role: "dialog", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440\u044B \u0440\u0435\u0435\u0441\u0442\u0440\u0430", style: { top: filterPopoverBox.top, left: filterPopoverBox.left, minWidth: filterPopoverBox.minWidth }, children: [_jsx("p", { className: "corr__popover-title", children: "\u0422\u0438\u043F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" }), _jsx("div", { className: "corr__filter-type-list", children: CORR_DOC_TYPE_KEYS.map((key) => (_jsxs("label", { className: "corr__filter-check", children: [_jsx("input", { type: "checkbox", checked: filterDraft[key], onChange: () => setFilterDraft((ft) => ({ ...ft, [key]: !ft[key] })) }), CORR_TYPE_BADGE[key].label] }, key))) }), tableTab !== 'attention' ? (_jsxs("div", { className: "corr__popover-field", children: [_jsx("span", { className: "corr__popover-label", id: "corr-filter-partner-label", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440" }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "corr-modal__srch", buttonClassName: "corr-modal__srch-btn", "aria-labelledby": "corr-filter-partner-label", placeholder: "\u0412\u0441\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u044B", value: String(extraDraft.partnerUserId ?? 0), items: partnerSelectItems, getOptionValue: (o) => String(o.id), getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => setExtraDraft((f) => ({ ...f, partnerUserId: o.id > 0 ? o.id : null })) })] })) : null, usersFilterAvailable ? (_jsxs("div", { className: "corr__popover-field", children: [_jsx("span", { className: "corr__popover-label", id: "corr-filter-user-label", children: "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439" }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "corr-modal__srch", buttonClassName: "corr-modal__srch-btn", "aria-labelledby": "corr-filter-user-label", placeholder: "\u0412\u0441\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438", value: String(extraDraft.responsibleUserId ?? 0), items: userSelectItems, getOptionValue: (o) => String(o.id), getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => setExtraDraft((f) => ({ ...f, responsibleUserId: o.id > 0 ? o.id : null })) })] })) : null, _jsx("p", { className: "corr__popover-title", children: "\u041F\u0435\u0440\u0438\u043E\u0434" }), _jsxs("div", { className: "corr__popover-dates", children: [_jsxs("div", { className: "corr__popover-field corr__popover-field--tight", children: [_jsx("span", { className: "corr__popover-label", children: "\u0421" }), _jsx(DatePicker, { value: extraDraft.dateFrom, max: extraDraft.dateTo || undefined, onChange: (iso) => setExtraDraft((f) => ({ ...f, dateFrom: iso })), portal: true, portalZIndex: 10120, emptyLabel: "\u2014", title: "\u0414\u0430\u0442\u0430 \u0441" })] }), _jsxs("div", { className: "corr__popover-field corr__popover-field--tight", children: [_jsx("span", { className: "corr__popover-label", children: "\u041F\u043E" }), _jsx(DatePicker, { value: extraDraft.dateTo, min: extraDraft.dateFrom || undefined, onChange: (iso) => setExtraDraft((f) => ({ ...f, dateTo: iso })), portal: true, portalZIndex: 10120, emptyLabel: "\u2014", title: "\u0414\u0430\u0442\u0430 \u043F\u043E" })] })] }), (extraDraft.dateFrom || extraDraft.dateTo) ? (_jsx("button", { type: "button", className: "corr__popover-item", onClick: () => setExtraDraft((f) => ({ ...f, dateFrom: '', dateTo: '' })), children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0434\u0430\u0442\u044B" })) : null, _jsx("div", { className: "corr__popover-divider" }), _jsxs("div", { className: "corr__popover-footer", children: [_jsx("button", { type: "button", className: "corr__popover-btn", onClick: resetFilters, children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "corr__popover-btn corr__popover-btn--primary", onClick: applyTypeFilters, children: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C" })] })] })] }), document.body) : null, settingsOpen && settingsPopoverBox ? createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: "corr__popover-backdrop corr__popover-backdrop--enter", onClick: closeOverlays, "aria-hidden": true }), _jsx("div", { className: "corr__popover corr__popover--enter", role: "menu", style: { top: settingsPopoverBox.top, left: settingsPopoverBox.left, minWidth: settingsPopoverBox.minWidth }, children: _jsx("button", { type: "button", className: "corr__popover-item", role: "menuitem", onClick: () => {
                                closeOverlays();
                                void showAlert({ title: 'Экспорт', message: 'Выгрузка в Excel появится в следующей версии.' });
                            }, children: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432 Excel" }) })] }), document.body) : null, rowMenuOpenId && rowMenuPopoverBox && rowMenuRow ? createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: "corr__popover-backdrop corr__popover-backdrop--enter", onClick: closeOverlays, "aria-hidden": true }), _jsxs("div", { className: "corr__popover corr__popover--enter", role: "menu", style: { top: rowMenuPopoverBox.top, left: rowMenuPopoverBox.left, minWidth: rowMenuPopoverBox.minWidth }, children: [_jsx("button", { type: "button", className: "corr__popover-item", role: "menuitem", onClick: () => {
                                    setRowMenuOpenId(null);
                                    setCardDocId(rowMenuRow.id);
                                }, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443" }), direction === 'incoming' && rowMenuRow.hasScan ? (_jsx("button", { type: "button", className: "corr__popover-item", role: "menuitem", onClick: () => void viewScan(rowMenuRow), children: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0441\u043A\u0430\u043D" })) : null, _jsx("button", { type: "button", className: "corr__popover-item", role: "menuitem", onClick: () => void downloadAttachment(rowMenuRow), children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B" }), _jsx("div", { className: "corr__popover-divider" }), _jsx("button", { type: "button", className: "corr__popover-item", role: "menuitem", onClick: () => void archiveRow(rowMenuRow), children: "\u0412 \u0430\u0440\u0445\u0438\u0432" }), canDelete ? (_jsx("button", { type: "button", className: "corr__popover-item corr__popover-item--danger", role: "menuitem", onClick: () => void deleteRow(rowMenuRow), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })) : null] })] }), document.body) : null, _jsx(CorrespondenceDocumentCardModal, { open: cardDocId !== null, documentId: cardDocId, onClose: () => setCardDocId(null), onChanged: () => {
                    // Refresh list after approve/reject/resubmit
                    setReloadToken((n) => n + 1);
                } }), _jsx(CorrespondenceRegisterIncomingModal, { open: incomingModalOpen, onClose: () => setIncomingModalOpen(false), onSubmit: handleIncomingSubmit, submitPending: registerPending }), _jsx(CorrespondenceRegisterOutgoingModal, { open: outgoingModalOpen, onClose: () => setOutgoingModalOpen(false), onSubmit: handleOutgoingSubmit, submitPending: registerPending })] }));
}
