import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    dedupeHikvisionUsers,
    deleteHikvisionMapping,
    fetchHikvisionUsers,
    listHikvisionMappings,
    upsertHikvisionMapping,
    type HikvisionUserBinding,
    type HikvisionUserRow,
} from '@entities/attendance';
import { getUsers, type User } from '@entities/user';
import { useI18n } from '@shared/i18n';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { fillAttendanceTemplate } from '../model/attendanceI18n';

type HikvisionUserLinkModalProps = {
    onClose: () => void;
    onMappingsChanged?: () => void;
};

type RowDraft = {
    appUserId: string;
    saving: boolean;
    savedFlash: boolean;
    resetting: boolean;
};

type AppUserOption = {
    id: string;
    user: User;
    label: string;
    search: string;
};

const HIKVISION_USER_SELECT_Z = 12100;

function userLabel(user: User): string {
    const name = user.display_name || user.email || `ID ${user.id}`;
    return user.email ? `${name} (${user.email})` : name;
}

export function HikvisionUserLinkModal({ onClose, onMappingsChanged }: HikvisionUserLinkModalProps) {
    const { t } = useI18n();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deviceErrors, setDeviceErrors] = useState<string[]>([]);
    const [users, setUsers] = useState<HikvisionUserRow[]>([]);
    const [cameraCount, setCameraCount] = useState(0);
    const [appUsers, setAppUsers] = useState<User[]>([]);
    const [mappings, setMappings] = useState<Record<string, HikvisionUserBinding>>({});
    const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

    const mappingByEmployeeNo = mappings;

    const load = useCallback(async (nameFilter?: string) => {
        setLoading(true);
        setError(null);
        setDeviceErrors([]);
        try {
            const [devices, mappingList, systemUsers] = await Promise.all([
                fetchHikvisionUsers(nameFilter),
                listHikvisionMappings(),
                getUsers(),
            ]);
            const deduped = dedupeHikvisionUsers(devices);
            const byNo: Record<string, HikvisionUserBinding> = {};
            for (const m of mappingList) {
                const no = (m.camera_employee_no || '').trim();
                if (no)
                    byNo[no] = m;
            }
            setUsers(deduped.users);
            setCameraCount(deduped.cameraCount);
            setDeviceErrors(deduped.errors);
            setMappings(byNo);
            setAppUsers(systemUsers.filter((u) => !u.is_archived && !u.is_blocked));
            const nextDrafts: Record<string, RowDraft> = {};
            for (const row of deduped.users) {
                const no = row.employeeNo === '-' ? '' : row.employeeNo;
                const current = no ? byNo[no] : undefined;
                nextDrafts[no || row.name] = {
                    appUserId: current?.app_user_id != null ? String(current.app_user_id) : '',
                    saving: false,
                    savedFlash: false,
                    resetting: false,
                };
            }
            setDrafts(nextDrafts);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('attendancePage.hikvisionModal.loadFailed'));
            setUsers([]);
            setCameraCount(0);
        }
        finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const sortedAppUsers = useMemo(() => {
        return [...appUsers].sort((a, b) => userLabel(a).localeCompare(userLabel(b), 'ru', { sensitivity: 'base' }));
    }, [appUsers]);

    const appUserOptions = useMemo((): AppUserOption[] => {
        return sortedAppUsers.map((u) => {
            const label = userLabel(u);
            return {
                id: String(u.id),
                user: u,
                label,
                search: `${label} ${u.email ?? ''}`.toLowerCase(),
            };
        });
    }, [sortedAppUsers]);

    const handleSearch = useCallback(() => {
        void load(search.trim() || undefined);
    }, [load, search]);

    const setDraft = useCallback((key: string, patch: Partial<RowDraft>) => {
        setDrafts((prev) => ({
            ...prev,
            [key]: { ...prev[key], ...patch },
        }));
    }, []);

    const handleSave = useCallback(async (row: HikvisionUserRow) => {
        const employeeNo = row.employeeNo === '-' ? '' : row.employeeNo.trim();
        const draftKey = employeeNo || row.name;
        const draft = drafts[draftKey];
        const selectedId = Number(draft?.appUserId || 0);
        if (!employeeNo || !selectedId) {
            setError(t('attendancePage.hikvisionModal.selectUser'));
            return;
        }
        setError(null);
        setDraft(draftKey, { saving: true, savedFlash: false });
        try {
            const saved = await upsertHikvisionMapping({
                camera_employee_no: employeeNo,
                app_user_id: selectedId,
                camera_name: row.name !== '-' ? row.name : null,
            });
            setMappings((prev) => ({ ...prev, [employeeNo]: saved }));
            setDraft(draftKey, { saving: false, savedFlash: true });
            onMappingsChanged?.();
            window.setTimeout(() => setDraft(draftKey, { savedFlash: false }), 1200);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('attendancePage.hikvisionModal.saveFailed'));
            setDraft(draftKey, { saving: false });
        }
    }, [drafts, onMappingsChanged, setDraft, t]);

    const handleReset = useCallback(async (row: HikvisionUserRow) => {
        const employeeNo = row.employeeNo === '-' ? '' : row.employeeNo.trim();
        const draftKey = employeeNo || row.name;
        if (!employeeNo)
            return;
        setError(null);
        setDraft(draftKey, { resetting: true });
        try {
            await deleteHikvisionMapping(employeeNo);
            setMappings((prev) => {
                const next = { ...prev };
                delete next[employeeNo];
                return next;
            });
            setDraft(draftKey, { appUserId: '', resetting: false });
            onMappingsChanged?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('attendancePage.hikvisionModal.resetFailed'));
            setDraft(draftKey, { resetting: false });
        }
    }, [onMappingsChanged, setDraft, t]);

    const mappedCount = useMemo(() => {
        return users.filter((u) => {
            const no = u.employeeNo === '-' ? '' : u.employeeNo;
            return no && mappingByEmployeeNo[no];
        }).length;
    }, [users, mappingByEmployeeNo]);

    const modal = (
        <div className="att-modal att-modal--hikvision" role="dialog" aria-modal="true" aria-labelledby="att-hikvision-modal-title">
            <div className="att-modal__backdrop" aria-hidden onClick={onClose} />
            <div className="att-modal__dialog att-modal__dialog--wide">
                <div className="att-modal__head">
                    <div className="att-modal__head-left">
                        <div className="att-modal__head-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                        </div>
                        <div>
                            <h2 id="att-hikvision-modal-title" className="att-modal__title">{t('attendancePage.hikvisionModal.title')}</h2>
                            <p className="att-modal__desc">{t('attendancePage.hikvisionModal.desc')}</p>
                        </div>
                    </div>
                    <button type="button" className="att-modal__close" onClick={onClose} aria-label={t('attendancePage.close')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div className="att-modal__body att-modal__body--hikvision">
                    <div className="att-hikvision__metrics">
                        <span>{fillAttendanceTemplate(t('attendancePage.hikvisionModal.metricUsers'), { count: String(users.length) })}</span>
                        <span>{fillAttendanceTemplate(t('attendancePage.hikvisionModal.metricCameras'), { count: String(cameraCount) })}</span>
                        <span>{fillAttendanceTemplate(t('attendancePage.hikvisionModal.metricMapped'), { count: String(mappedCount) })}</span>
                    </div>

                    <div className="att-hikvision__toolbar">
                        <input
                            type="search"
                            className="att-modal__input"
                            placeholder={t('attendancePage.hikvisionModal.search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                    handleSearch();
                            }}
                            disabled={loading}
                        />
                        <button type="button" className="att__btn att__btn--ghost" onClick={handleSearch} disabled={loading}>
                            {t('attendancePage.hikvisionModal.searchBtn')}
                        </button>
                        <button type="button" className="att__btn att__btn--ghost" onClick={() => void load(search.trim() || undefined)} disabled={loading}>
                            {t('attendancePage.refresh')}
                        </button>
                    </div>

                    {error && (
                        <div className="att__alert" role="alert">
                            <span>{error}</span>
                        </div>
                    )}
                    {deviceErrors.length > 0 && (
                        <div className="att__alert att__alert--muted" role="status">
                            <span>{deviceErrors.join(' | ')}</span>
                        </div>
                    )}

                    <div className="att-hikvision__table-wrap">
                        <table className="att-hikvision__table">
                            <colgroup>
                                <col className="att-hikvision__col att-hikvision__col--camera" />
                                <col className="att-hikvision__col att-hikvision__col--emp-no" />
                                <col className="att-hikvision__col att-hikvision__col--name" />
                                <col className="att-hikvision__col att-hikvision__col--dept" />
                                <col className="att-hikvision__col att-hikvision__col--user" />
                                <col className="att-hikvision__col att-hikvision__col--actions" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>{t('attendancePage.hikvisionModal.colCamera')}</th>
                                    <th>{t('attendancePage.hikvisionModal.colEmployeeNo')}</th>
                                    <th>{t('attendancePage.hikvisionModal.colHikvisionName')}</th>
                                    <th>{t('attendancePage.hikvisionModal.colDepartment')}</th>
                                    <th>{t('attendancePage.hikvisionModal.colSystemUser')}</th>
                                    <th>{t('attendancePage.hikvisionModal.colActions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="att-hikvision__empty">{t('attendancePage.hikvisionModal.loading')}</td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="att-hikvision__empty">{t('attendancePage.hikvisionModal.empty')}</td>
                                    </tr>
                                ) : users.map((row) => {
                                    const employeeNo = row.employeeNo === '-' ? '' : row.employeeNo;
                                    const draftKey = employeeNo || row.name;
                                    const draft = drafts[draftKey] || { appUserId: '', saving: false, savedFlash: false, resetting: false };
                                    const isMapped = Boolean(employeeNo && mappingByEmployeeNo[employeeNo]);
                                    const cameraLine = row.cameras.join(', ') || '—';
                                    return (
                                        <tr key={draftKey} className={isMapped ? 'att-hikvision__row--mapped' : ''}>
                                            <td className="att-hikvision__cell-camera" title={cameraLine}>{cameraLine}</td>
                                            <td className="att-hikvision__cell-mono">{employeeNo || '—'}</td>
                                            <td className="att-hikvision__cell-name">{row.name}</td>
                                            <td>{row.department || '—'}</td>
                                            <td>
                                                <SearchableSelect<AppUserOption>
                                                    portalDropdown
                                                    portalZIndex={HIKVISION_USER_SELECT_Z}
                                                    portalMinWidth={360}
                                                    portalDropdownClassName="tsp-srch__dropdown--tall att-hikvision__user-dropdown"
                                                    className="att-hikvision__user-select"
                                                    buttonClassName="att-hikvision__user-select-btn"
                                                    placeholder={t('attendancePage.hikvisionModal.unlinked')}
                                                    emptyListText={t('attendancePage.hikvisionModal.noUsers')}
                                                    noMatchText={t('attendancePage.hikvisionModal.noMatch')}
                                                    value={draft.appUserId}
                                                    items={appUserOptions}
                                                    getOptionValue={(o) => o.id}
                                                    getOptionLabel={(o) => o.label}
                                                    getSearchText={(o) => o.search}
                                                    disabled={draft.saving || draft.resetting || !employeeNo}
                                                    onSelect={(o) => setDraft(draftKey, { appUserId: o.id })}
                                                    renderButtonContent={(o) => (
                                                        <span className="att-hikvision__user-pick">
                                                            <span className="att-hikvision__user-pick-name">{o.user.display_name || o.user.email || `ID ${o.user.id}`}</span>
                                                            {o.user.email ? (
                                                                <span className="att-hikvision__user-pick-email">{o.user.email}</span>
                                                            ) : null}
                                                        </span>
                                                    )}
                                                    renderOption={(o) => (
                                                        <span className="att-hikvision__user-opt">
                                                            <span className="att-hikvision__user-opt-name">{o.user.display_name || o.user.email || `ID ${o.user.id}`}</span>
                                                            {o.user.email ? (
                                                                <span className="att-hikvision__user-opt-email">{o.user.email}</span>
                                                            ) : null}
                                                        </span>
                                                    )}
                                                />
                                            </td>
                                            <td>
                                                <div className="att-hikvision__actions">
                                                    <button
                                                        type="button"
                                                        className="att__btn att__btn--accent att-hikvision__save"
                                                        disabled={draft.saving || draft.resetting || !employeeNo}
                                                        onClick={() => void handleSave(row)}
                                                    >
                                                        {draft.saving
                                                            ? t('attendancePage.hikvisionModal.saving')
                                                            : draft.savedFlash
                                                                ? t('attendancePage.hikvisionModal.saved')
                                                                : t('attendancePage.hikvisionModal.save')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="att__btn att__btn--ghost"
                                                        disabled={draft.saving || draft.resetting || !isMapped}
                                                        onClick={() => void handleReset(row)}
                                                    >
                                                        {draft.resetting
                                                            ? t('attendancePage.hikvisionModal.resetting')
                                                            : t('attendancePage.hikvisionModal.reset')}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined')
        return modal;
    return createPortal(modal, document.body);
}
