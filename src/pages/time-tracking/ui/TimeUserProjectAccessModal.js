import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useId, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjectAccess, getTimeTrackingUser, putUserProjectAccess, patchTimeTrackingUserTransferWithoutProjectAccess, listAllClientProjectsForPicker, listAllTimeManagerClientsMerged, userFacingProjectAccessError, } from '@entities/time-tracking';
import { getUserEditUrl } from '@shared/config';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination } from '@shared/ui/Pagination';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
export function TimeUserProjectAccessModal({ authUserId, userLabel, canSave, onClose, }) {
    const { t } = useI18n();
    const uid = useId();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [clientNames, setClientNames] = useState(new Map());
    const [selected, setSelected] = useState(() => new Set());
    const [transferWithoutProjectAccess, setTransferWithoutProjectAccess] = useState(false);
    const [transferFlagLoaded, setTransferFlagLoaded] = useState(false);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => window.clearTimeout(t);
    }, [query]);
    const PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
    const [accessPage, setAccessPage] = useState(1);
    useEffect(() => {
        setAccessPage(1);
    }, [debouncedQuery, authUserId]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([
            getUserProjectAccess(authUserId),
            listAllClientProjectsForPicker(),
            listAllTimeManagerClientsMerged(),
            getTimeTrackingUser(authUserId).catch(() => null),
        ])
            .then(([access, allProjects, clients, ttUser]) => {
            if (cancelled)
                return;
            setProjects(allProjects);
            setSelected(new Set(access.projectIds));
            setClientNames(new Map(clients.map((c) => [c.id, c.name])));
            setTransferWithoutProjectAccess(ttUser?.can_transfer_time_without_project_access === true);
            setTransferFlagLoaded(true);
        })
            .catch((e) => {
            if (cancelled)
                return;
            setError(e instanceof Error ? e.message : t('timeTrackingPage.users.projectAccessModal.loadFailed'));
            setProjects([]);
            setSelected(new Set());
            setClientNames(new Map());
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [authUserId, t]);
    const q = query.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (!q)
            return projects;
        return projects.filter((p) => {
            const cname = (clientNames.get(p.client_id) ?? '').toLowerCase();
            const name = p.name.toLowerCase();
            const code = (p.code ?? '').toLowerCase();
            return name.includes(q) || code.includes(q) || cname.includes(q);
        });
    }, [projects, clientNames, q]);
    const filteredSorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const na = clientNames.get(a.client_id) ?? a.client_id;
            const nb = clientNames.get(b.client_id) ?? b.client_id;
            const c = na.localeCompare(nb, 'ru', { sensitivity: 'base' });
            if (c !== 0)
                return c;
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });
    }, [filtered, clientNames]);
    const filteredPageSlice = useMemo(() => {
        const start = (accessPage - 1) * PAGE;
        return filteredSorted.slice(start, start + PAGE);
    }, [filteredSorted, accessPage, PAGE]);
    const grouped = useMemo(() => {
        const m = new Map();
        for (const p of filteredPageSlice) {
            const list = m.get(p.client_id) ?? [];
            list.push(p);
            m.set(p.client_id, list);
        }
        const clientIds = [...m.keys()].sort((a, b) => {
            const na = clientNames.get(a) ?? a;
            const nb = clientNames.get(b) ?? b;
            return na.localeCompare(nb, 'ru', { sensitivity: 'base' });
        });
        return { m, clientIds };
    }, [filteredPageSlice, clientNames]);
    const toggle = useCallback((projectId) => {
        if (!canSave)
            return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(projectId))
                next.delete(projectId);
            else
                next.add(projectId);
            return next;
        });
    }, [canSave]);
    const selectAllFiltered = useCallback(() => {
        if (!canSave)
            return;
        setSelected((prev) => {
            const next = new Set(prev);
            for (const p of filteredPageSlice)
                next.add(p.id);
            return next;
        });
    }, [canSave, filteredPageSlice]);
    const clearAllFiltered = useCallback(() => {
        if (!canSave)
            return;
        setSelected((prev) => {
            const next = new Set(prev);
            for (const p of filteredPageSlice)
                next.delete(p.id);
            return next;
        });
    }, [canSave, filteredPageSlice]);
    const handleSave = async () => {
        if (!canSave)
            return;
        setSaving(true);
        setError(null);
        try {
            const out = await putUserProjectAccess(authUserId, [...selected]);
            setSelected(new Set(out.projectIds));
            if (canSave && transferFlagLoaded) {
                await patchTimeTrackingUserTransferWithoutProjectAccess(authUserId, transferWithoutProjectAccess);
            }
            onClose();
        }
        catch (e) {
            const raw = e instanceof Error ? e.message : t('timeTrackingPage.users.projectAccessModal.saveFailed');
            setError(userFacingProjectAccessError(raw));
            try {
                const a = await getUserProjectAccess(authUserId);
                setSelected(new Set(a.projectIds));
            }
            catch {
            }
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--project-access", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-pa-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-pa-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.users.projectAccessModal.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body tt-project-access-modal__body", children: [_jsxs("p", { className: "tt-project-access-modal__lead", children: [t('timeTrackingPage.users.projectAccessModal.userLabel'), " ", _jsx("strong", { children: userLabel })] }), _jsx("p", { className: "tt-project-access-modal__hint tt-project-access-modal__hint--info", role: "note", children: t('timeTrackingPage.users.projectAccessModal.billableRateHint') }), _jsx("p", { className: "tt-project-access-modal__hint tt-project-access-modal__hint--info", role: "note", children: t('timeTrackingPage.users.projectAccessModal.partnerRuleHint') }), canSave && transferFlagLoaded ? (_jsxs("label", { className: "tt-project-access-modal__transfer-flag", children: [_jsx("input", { type: "checkbox", checked: transferWithoutProjectAccess, disabled: saving || loading, onChange: (e) => setTransferWithoutProjectAccess(e.target.checked) }), _jsx("span", { children: t('timeTrackingPage.users.projectAccessModal.transferWithoutProjectAccess') })] })) : null, canSave && transferFlagLoaded ? (_jsx("p", { className: "tt-project-access-modal__hint tt-project-access-modal__hint--info", role: "note", children: t('timeTrackingPage.users.projectAccessModal.transferWithoutProjectAccessHint') })) : null, !canSave && (_jsx("p", { className: "tt-project-access-modal__hint", role: "status", children: t('timeTrackingPage.users.projectAccessModal.viewOnly') })), error && (_jsx("p", { className: "tt-settings__banner-error tt-project-access-modal__err", role: "alert", children: error })), error && canSave && (_jsxs("p", { className: "tt-project-access-modal__hint", style: { marginTop: '0.35rem' }, children: [_jsx(Link, { to: getUserEditUrl(authUserId), style: { color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }, children: t('timeTrackingPage.users.projectAccessModal.userCardLink') }), ' ', "(", _jsx(Link, { to: `${getUserEditUrl(authUserId)}?tab=rates`, style: { color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }, children: t('timeTrackingPage.users.projectAccessModal.ratesLink') }), ', ', _jsx(Link, { to: `${getUserEditUrl(authUserId)}?tab=projects`, style: { color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }, children: t('timeTrackingPage.users.projectAccessModal.projectsLink') }), ")"] })), _jsxs("div", { className: "tt-project-access-modal__toolbar", children: [_jsx("label", { className: "tt-project-access-modal__search-label", htmlFor: `${uid}-q`, children: t('timeTrackingPage.users.projectAccessModal.search') }), _jsx("input", { id: `${uid}-q`, type: "search", className: "tt-tm-input tt-project-access-modal__search", placeholder: t('timeTrackingPage.users.projectAccessModal.searchPlaceholder'), value: query, onChange: (e) => setQuery(e.target.value), disabled: loading }), canSave && !loading && filteredPageSlice.length > 0 && (_jsxs("div", { className: "tt-project-access-modal__bulk", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--link", onClick: selectAllFiltered, children: t('timeTrackingPage.users.projectAccessModal.selectPage') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--link", onClick: clearAllFiltered, children: t('timeTrackingPage.users.projectAccessModal.clearPage') })] }))] }), loading ? (_jsx("p", { className: "tt-project-access-modal__loading", children: t('timeTrackingPage.users.projectAccessModal.loading') })) : projects.length === 0 ? (_jsx("p", { className: "tt-project-access-modal__empty", children: t('timeTrackingPage.users.projectAccessModal.noProjects') })) : (_jsxs("div", { className: "tt-project-access-modal__list", role: "group", "aria-label": t('timeTrackingPage.users.projectAccessModal.projectsGroupAria'), children: [grouped.clientIds.map((cid) => {
                                    const rows = grouped.m.get(cid) ?? [];
                                    if (rows.length === 0)
                                        return null;
                                    const cname = clientNames.get(cid) ?? cid;
                                    return (_jsxs("section", { className: "tt-project-access-modal__group", children: [_jsx("h3", { className: "tt-project-access-modal__group-title", children: cname }), _jsx("ul", { className: "tt-project-access-modal__ul", children: rows.map((p) => {
                                                    const checked = selected.has(p.id);
                                                    return (_jsx("li", { children: _jsxs("label", { className: `tt-project-access-modal__row${!canSave ? ' tt-project-access-modal__row--disabled' : ''}`, children: [_jsx("input", { type: "checkbox", checked: checked, disabled: !canSave, onChange: () => toggle(p.id) }), _jsxs("span", { className: "tt-project-access-modal__row-text", children: [_jsx("span", { className: "tt-project-access-modal__row-name", children: p.name }), p.code ? (_jsx("span", { className: "tt-project-access-modal__row-code", children: p.code })) : null] })] }) }, p.id));
                                                }) })] }, cid));
                                }), !loading && filtered.length > PAGE ? (_jsx(Pagination, { page: accessPage, totalCount: filtered.length, pageSize: PAGE, onPageChange: setAccessPage })) : null] }))] }), _jsxs("div", { className: "tt-tm-modal__foot tt-project-access-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", onClick: onClose, children: t('timeTrackingPage.close') }), canSave && (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving || loading, onClick: () => void handleSave(), children: saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.save') }))] })] }) }));
}
