import { useState, useEffect, useMemo, useId, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUserProjectAccess, putUserProjectAccess, listAllClientProjectsForPicker, listAllTimeManagerClientsMerged, userFacingProjectAccessError, type TimeManagerClientProjectRow, } from '@entities/time-tracking';
import { getUserEditUrl } from '@shared/config';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { Pagination } from '@shared/ui/Pagination';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
type TimeUserProjectAccessModalProps = {
    authUserId: number;
    userLabel: string;
    canSave: boolean;
    onClose: () => void;
};
export function TimeUserProjectAccessModal({ authUserId, userLabel, canSave, onClose, }: TimeUserProjectAccessModalProps) {
    const uid = useId();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [projects, setProjects] = useState<TimeManagerClientProjectRow[]>([]);
    const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
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
        ])
            .then(([access, allProjects, clients]) => {
                if (cancelled)
                    return;
                setProjects(allProjects);
                setSelected(new Set(access.projectIds));
                setClientNames(new Map(clients.map((c) => [c.id, c.name])));
            })
            .catch((e) => {
                if (cancelled)
                    return;
                setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
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
    }, [authUserId]);
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
            onClose();
        }
        catch (e) {
            const raw = e instanceof Error ? e.message : 'Не удалось сохранить';
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
                    Доступ к проектам
                </h2>
                <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="tt-tm-modal__body tt-project-access-modal__body">
                <p className="tt-project-access-modal__lead">
                    Пользователь: <strong>{userLabel}</strong>
                </p>
                <p className="tt-project-access-modal__hint tt-project-access-modal__hint--info" role="note">
                    Сохранение списка проверяет почасовые ставки: для каждого выбранного проекта на текущую дату должна быть действующая{' '}
                    <strong>оплачиваемая (billable)</strong> ставка в <strong>валюте этого проекта</strong>. Проверка <strong>себестоимости (cost)</strong> на стороне сервиса пока не обязательна. Если сервер вернёт ошибку 400 — текст ответа будет показан ниже; при необходимости откройте вкладку «Ставки» в карточке пользователя.
                </p>
                <p className="tt-project-access-modal__hint tt-project-access-modal__hint--info" role="note">
                    Дополнительно: если у проекта уже есть доступ у сотрудников, среди них должен остаться минимум один с должностью{' '}
                    <strong>партнёра</strong> (поле должности в профиле / справочнике TT: «партн…» или <code className="tt-project-access-modal__code">partner</code> в латинице). Пустой состав не проверяется. Сообщение об ошибке 400 — ниже; для правила партнёра текст может быть упрощён.
                </p>
                {!canSave && (<p className="tt-project-access-modal__hint" role="status">
                    Только просмотр: изменять список могут главный администратор, администратор, партнёр или менеджер учёта
                    времени.
                </p>)}
                {error && (<p className="tt-settings__banner-error tt-project-access-modal__err" role="alert">
                    {error}
                </p>)}
                {error && canSave && (<p className="tt-project-access-modal__hint" style={{ marginTop: '0.35rem' }}>
                    <Link to={getUserEditUrl(authUserId)} style={{ color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }}>
                        Карточка пользователя
                    </Link>
                    {' '}
                    (
                    <Link to={`${getUserEditUrl(authUserId)}?tab=rates`} style={{ color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }}>
                        ставки
                    </Link>
                    {', '}
                    <Link to={`${getUserEditUrl(authUserId)}?tab=projects`} style={{ color: 'var(--app-accent, #2563eb)', textDecoration: 'underline' }}>
                        проекты
                    </Link>
                    )
                </p>)}
                <div className="tt-project-access-modal__toolbar">
                    <label className="tt-project-access-modal__search-label" htmlFor={`${uid}-q`}>
                        Поиск
                    </label>
                    <input id={`${uid}-q`} type="search" className="tt-tm-input tt-project-access-modal__search" placeholder="Клиент, проект, код…" value={query} onChange={(e) => setQuery(e.target.value)} disabled={loading} />
                    {canSave && !loading && filteredPageSlice.length > 0 && (<div className="tt-project-access-modal__bulk">
                        <button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={selectAllFiltered}>
                            Отметить на странице
                        </button>
                        <button type="button" className="tt-settings__btn tt-settings__btn--link" onClick={clearAllFiltered}>
                            Снять на странице
                        </button>
                    </div>)}
                </div>
                {loading ? (<p className="tt-project-access-modal__loading">Загрузка…</p>) : projects.length === 0 ? (<p className="tt-project-access-modal__empty">Нет проектов в справочнике.</p>) : (<div className="tt-project-access-modal__list" role="group" aria-label="Проекты">
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
                    Закрыть
                </button>
                {canSave && (<button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || loading} onClick={() => void handleSave()}>
                    {saving ? 'Сохранение…' : 'Сохранить'}
                </button>)}
            </div>
        </div>
    </div>);
}
