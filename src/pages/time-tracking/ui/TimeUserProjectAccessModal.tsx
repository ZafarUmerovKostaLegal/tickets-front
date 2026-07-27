import { useState, useEffect, useMemo, useId, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjectAccess, getTimeTrackingUser, putUserProjectAccess, patchTimeTrackingUserTransferWithoutProjectAccess, listAllClientProjectsForPicker, listAllTimeManagerClientsMerged, userFacingProjectAccessError, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { getUserEditUrl } from '@shared/config';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination } from '@shared/ui/Pagination';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
type TimeUserProjectAccessModalProps = {
    authUserId: number;
    userLabel: string;
    canSave: boolean;
    onClose: () => void;
};
export function TimeUserProjectAccessModal({ authUserId, userLabel, canSave, onClose, }: TimeUserProjectAccessModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [projects, setProjects] = useState<TimeManagerClientProjectRow[]>([]);
    const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
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
        const m = new Map<string, TimeManagerClientProjectRow[]>();
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
    const toggle = useCallback((projectId: string) => {
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
                await patchTimeTrackingUserTransferWithoutProjectAccess(
                    authUserId,
                    transferWithoutProjectAccess,
                );
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
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
        <div className="tt-tm-modal tt-tm-modal--project-access" role="dialog" aria-modal="true" aria-labelledby={`${uid}-pa-title`} onClick={(ev) => ev.stopPropagation()}>
            <div className="tt-tm-modal__head">
                <h2 id={`${uid}-pa-title`} className="tt-tm-modal__title">
                    {t('timeTrackingPage.users.projectAccessModal.title')}
                </h2>
                <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="tt-tm-modal__body tt-project-access-modal__body">
                <p className="tt-project-access-modal__lead">
                    {t('timeTrackingPage.users.projectAccessModal.userLabel')} <strong>{userLabel}</strong>
                </p>
                <p className="tt-project-access-modal__hint tt-project-access-modal__hint--info" role="note">
                    {t('timeTrackingPage.users.projectAccessModal.billableRateHint')}
                </p>
                <p className="tt-project-access-modal__hint tt-project-access-modal__hint--info" role="note">
                    {t('timeTrackingPage.users.projectAccessModal.partnerRuleHint')}
                </p>
                {canSave && transferFlagLoaded ? (
                    <label className="tt-project-access-modal__transfer-flag">
                        <input
                            type="checkbox"
                            checked={transferWithoutProjectAccess}
                            disabled={saving || loading}
                            onChange={(e) => setTransferWithoutProjectAccess(e.target.checked)}
                        />
                        <span>{t('timeTrackingPage.users.projectAccessModal.transferWithoutProjectAccess')}</span>
                    </label>
                ) : null}
                {canSave && transferFlagLoaded ? (
                    <p className="tt-project-access-modal__hint tt-project-access-modal__hint--info" role="note">
                        {t('timeTrackingPage.users.projectAccessModal.transferWithoutProjectAccessHint')}
                    </p>
                ) : null}
                {!canSave && (<p className="tt-project-access-modal__hint" role="status">
                    {t('timeTrackingPage.users.projectAccessModal.viewOnly')}
                </p>)}
                {error && (<p className="tt-settings__banner-error tt-project-access-modal__err" role="alert">
                    {error}
                </p>)}
                {error && canSave && (<p className="tt-project-access-modal__hint" style={{ marginTop: '0.35rem' }}>
                    <Link to={getUserEditUrl(authUserId)} style={{ color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }}>
                        {t('timeTrackingPage.users.projectAccessModal.userCardLink')}
                    </Link>
                    {' '}
                    (
                    <Link to={`${getUserEditUrl(authUserId)}?tab=rates`} style={{ color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }}>
                        {t('timeTrackingPage.users.projectAccessModal.ratesLink')}
                    </Link>
                    {', '}
                    <Link to={`${getUserEditUrl(authUserId)}?tab=projects`} style={{ color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }}>
                        {t('timeTrackingPage.users.projectAccessModal.projectsLink')}
                    </Link>
                    )
                </p>)}
                <div className="tt-project-access-modal__toolbar">
                    <label className="tt-project-access-modal__search-label" htmlFor={`${uid}-q`}>
                        {t('timeTrackingPage.users.projectAccessModal.search')}
                    </label>
                    <input id={`${uid}-q`} type="search" className="tt-tm-input tt-project-access-modal__search" placeholder={t('timeTrackingPage.users.projectAccessModal.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} disabled={loading} />
                    {canSave && !loading && filteredPageSlice.length > 0 && (<div className="tt-project-access-modal__bulk">
                        <button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={selectAllFiltered}>
                            {t('timeTrackingPage.users.projectAccessModal.selectPage')}
                        </button>
                        <button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={clearAllFiltered}>
                            {t('timeTrackingPage.users.projectAccessModal.clearPage')}
                        </button>
                    </div>)}
                </div>
                {loading ? (<p className="tt-project-access-modal__loading">{t('timeTrackingPage.users.projectAccessModal.loading')}</p>) : projects.length === 0 ? (<p className="tt-project-access-modal__empty">{t('timeTrackingPage.users.projectAccessModal.noProjects')}</p>) : (<div className="tt-project-access-modal__list" role="group" aria-label={t('timeTrackingPage.users.projectAccessModal.projectsGroupAria')}>
                    {grouped.clientIds.map((cid) => {
                        const rows = grouped.m.get(cid) ?? [];
                        if (rows.length === 0)
                            return null;
                        const cname = clientNames.get(cid) ?? cid;
                        return (<section key={cid} className="tt-project-access-modal__group">
                            <h3 className="tt-project-access-modal__group-title">{cname}</h3>
                            <ul className="tt-project-access-modal__ul">
                                {rows.map((p) => {
                                    const checked = selected.has(p.id);
                                    return (<li key={p.id}>
                                        <label className={`tt-project-access-modal__row${!canSave ? ' tt-project-access-modal__row--disabled' : ''}`}>
                                            <input type="checkbox" checked={checked} disabled={!canSave} onChange={() => toggle(p.id)} />
                                            <span className="tt-project-access-modal__row-text">
                                                <span className="tt-project-access-modal__row-name">{p.name}</span>
                                                {p.code ? (<span className="tt-project-access-modal__row-code">{p.code}</span>) : null}
                                            </span>
                                        </label>
                                    </li>);
                                })}
                            </ul>
                        </section>);
                    })}
                    {!loading && filtered.length > PAGE ? (<Pagination page={accessPage} totalCount={filtered.length} pageSize={PAGE} onPageChange={setAccessPage} />) : null}
                </div>)}
            </div>
            <div className="tt-tm-modal__foot tt-project-access-modal__foot">
                <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={onClose}>
                    {t('timeTrackingPage.close')}
                </button>
                {canSave && (<button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || loading} onClick={() => void handleSave()}>
                    {saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.save')}
                </button>)}
            </div>
        </div>
    </div>);
}
