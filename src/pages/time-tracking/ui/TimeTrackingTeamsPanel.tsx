import './TimeTrackingForms.css';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
    createTimeTrackingTeam,
    deleteTimeTrackingTeam,
    isForbiddenError,
    listTimeTrackingTeams,
    listTimeTrackingUsers,
    patchTimeTrackingTeam,
    type TimeTrackingTeamRow,
    type TimeTrackingUserRow,
} from '@entities/time-tracking';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { SearchableSelect, useAppDialog } from '@shared/ui';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import './TimeTrackingTeamsPanel.css';

const IcoPen = () => (
    <svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const IcoTrash = () => (
    <svg className="tt-task-card__btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

function userLabel(u: TimeTrackingUserRow): string {
    return (u.display_name?.trim() || u.email || `#${u.id}`).trim();
}

function isStubAuthUserEmail(email: string | null | undefined): boolean {
    const v = String(email ?? '').trim().toLowerCase();
    return /^auth-user-\d+@tt\.local$/.test(v);
}

function resolveTeamMemberName(
    id: number,
    fromRow: { display_name?: string | null; email?: string } | undefined,
    usersById: Map<number, TimeTrackingUserRow>,
): string {
    const fromCatalog = usersById.get(id);
    const catalogName = fromCatalog?.display_name?.trim();
    if (catalogName)
        return catalogName;
    const rowName = fromRow?.display_name?.trim();
    if (rowName)
        return rowName;
    if (fromCatalog)
        return userLabel(fromCatalog);
    const email = fromRow?.email?.trim();
    if (email && !isStubAuthUserEmail(email))
        return email;
    return `#${id}`;
}

function userSearchText(u: TimeTrackingUserRow): string {
    return [u.display_name, u.email, u.position, String(u.id)].filter(Boolean).join(' ').trim();
}

function sortTeams(a: TimeTrackingTeamRow, b: TimeTrackingTeamRow): number {
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
}

type TeamFormState = {
    name: string;
    partnerId: string;
    memberIds: number[];
    isArchived: boolean;
};

function emptyTeamForm(partnerId = ''): TeamFormState {
    return {
        name: '',
        partnerId,
        memberIds: [],
        isArchived: false,
    };
}

function rowToTeamForm(row: TimeTrackingTeamRow): TeamFormState {
    return {
        name: row.name,
        partnerId: String(row.partner_auth_user_id),
        memberIds: [...row.member_auth_user_ids],
        isArchived: row.is_archived,
    };
}

type TeamModalProps = {
    mode: 'create' | 'edit';
    users: TimeTrackingUserRow[];
    partnerUsers: TimeTrackingUserRow[];
    initial: TimeTrackingTeamRow | null;
    onClose: () => void;
    onSaved: (row: TimeTrackingTeamRow) => void;
};

function TeamModal({ mode, users, partnerUsers, initial, onClose, onSaved }: TeamModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState<TeamFormState>(() => (
        initial ? rowToTeamForm(initial) : emptyTeamForm(partnerUsers[0] ? String(partnerUsers[0].id) : '')
    ));
    const [memberSearch, setMemberSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const memberCandidates = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return users
            .filter((u) => !u.is_archived && !u.is_blocked)
            .filter((u) => {
                if (!q)
                    return true;
                return userSearchText(u).toLowerCase().includes(q);
            })
            .sort((a, b) => userLabel(a).localeCompare(userLabel(b), 'ru', { sensitivity: 'base' }));
    }, [users, memberSearch]);

    const toggleMember = (id: number) => {
        setForm((prev) => {
            const has = prev.memberIds.includes(id);
            return {
                ...prev,
                memberIds: has ? prev.memberIds.filter((x) => x !== id) : [...prev.memberIds, id],
            };
        });
    };

    const handleSubmit = async () => {
        const name = form.name.trim();
        if (!name) {
            setError(t('timeTrackingPage.teams.errors.nameRequired'));
            return;
        }
        const partnerAuthUserId = Number(form.partnerId);
        if (!Number.isFinite(partnerAuthUserId) || partnerAuthUserId <= 0) {
            setError(t('timeTrackingPage.teams.errors.partnerRequired'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            if (mode === 'create') {
                const row = await createTimeTrackingTeam({
                    name,
                    partnerAuthUserId,
                    memberAuthUserIds: form.memberIds,
                });
                onSaved(row);
            }
            else if (initial) {
                const row = await patchTimeTrackingTeam(initial.id, {
                    name,
                    partnerAuthUserId,
                    memberAuthUserIds: form.memberIds,
                    isArchived: form.isArchived,
                });
                onSaved(row);
            }
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('timeTrackingPage.common.saveFailed'));
        }
        finally {
            setSaving(false);
        }
    };

    return portalTimeTrackingModal(
        <div className="tt-tm-modal-overlay" role="presentation">
            <div
                className="tt-tm-modal tt-tm-modal--task tt-tm-modal--team"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${uid}-team-title`}
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="tt-tm-modal__head">
                    <h2 id={`${uid}-team-title`} className="tt-tm-modal__title">
                        {mode === 'create'
                            ? t('timeTrackingPage.teams.modal.createTitle')
                            : t('timeTrackingPage.teams.modal.editTitle')}
                    </h2>
                    <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="tt-tm-modal__body">
                    <div className="tt-tm-field">
                        <label className="tt-tm-label" htmlFor={`${uid}-team-name`}>
                            {t('timeTrackingPage.teams.labels.name')} <span className="tt-tm-req">*</span>
                        </label>
                        <input
                            id={`${uid}-team-name`}
                            className="tt-tm-input"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        />
                    </div>

                    <div className="tt-tm-field">
                        <label className="tt-tm-label" id={`${uid}-partner-lbl`}>
                            {t('timeTrackingPage.teams.labels.partner')} <span className="tt-tm-req">*</span>
                        </label>
                        <SearchableSelect<TimeTrackingUserRow>
                            className="tt-tm-dd"
                            buttonClassName="tt-tm-dd__btn"
                            buttonId={`${uid}-partner`}
                            value={form.partnerId}
                            items={partnerUsers}
                            getOptionValue={(u) => String(u.id)}
                            getOptionLabel={userLabel}
                            getSearchText={userSearchText}
                            onSelect={(u) => setForm((f) => ({ ...f, partnerId: String(u.id) }))}
                            placeholder={t('timeTrackingPage.teams.labels.selectPartner')}
                            emptyListText={t('timeTrackingPage.teams.labels.noPartners')}
                            noMatchText={t('timeTrackingPage.common.notFound')}
                            disabled={partnerUsers.length === 0}
                            portalDropdown
                            portalZIndex={11020}
                            portalMinWidth={320}
                            aria-labelledby={`${uid}-partner-lbl`}
                            renderOption={(u) => (
                                <span className="tt-tm-dd__opt">
                                    <span className="tt-tm-dd__opt-name">{userLabel(u)}</span>
                                    {u.position ? <span className="tt-tm-dd__opt-sub">{u.position}</span> : null}
                                </span>
                            )}
                        />
                    </div>

                    <div className="tt-tm-field tt-teams-member-field">
                        <div className="tt-teams-member-field__toolbar">
                            <label className="tt-tm-label" htmlFor={`${uid}-member-search`}>
                                {t('timeTrackingPage.teams.labels.members')}
                            </label>
                            <span className="tt-teams-member-field__count">
                                {t('timeTrackingPage.teams.labels.membersSelected').replace('{count}', String(form.memberIds.length))}
                            </span>
                        </div>
                        <input
                            id={`${uid}-member-search`}
                            className="tt-tm-input"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder={t('timeTrackingPage.teams.labels.memberSearchPlaceholder')}
                        />
                        <div className="tt-teams-member-picker" role="group" aria-label={t('timeTrackingPage.teams.labels.members')}>
                            {memberCandidates.length === 0 ? (
                                <p className="tt-tm-hint tt-teams-member-picker__empty">{t('timeTrackingPage.teams.labels.noMembers')}</p>
                            ) : memberCandidates.map((u) => (
                                <label key={u.id} className="tt-teams-member-picker__row">
                                    <input
                                        type="checkbox"
                                        className="tt-teams-member-picker__check"
                                        checked={form.memberIds.includes(u.id)}
                                        onChange={() => toggleMember(u.id)}
                                    />
                                    <span className="tt-teams-member-picker__body">
                                        <span className="tt-teams-member-picker__name">{userLabel(u)}</span>
                                        {u.position ? (
                                            <span className="tt-teams-member-picker__sub">{u.position}</span>
                                        ) : null}
                                        {u.email ? (
                                            <span className="tt-teams-member-picker__email">{u.email}</span>
                                        ) : null}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {mode === 'edit' && (
                        <label className="tt-tm-check-row">
                            <input
                                type="checkbox"
                                checked={form.isArchived}
                                onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}
                            />
                            <span>{t('timeTrackingPage.common.archived')}</span>
                        </label>
                    )}

                    {error ? (
                        <p className="tt-tm-field-error" role="alert">{error}</p>
                    ) : null}
                </div>
                <div className="tt-tm-modal__foot">
                    <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
                        {t('timeTrackingPage.cancel')}
                    </button>
                    <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
                        {saving
                            ? t('timeTrackingPage.saving')
                            : mode === 'create'
                                ? t('timeTrackingPage.common.create')
                                : t('timeTrackingPage.save')}
                    </button>
                </div>
            </div>
        </div>,
    );
}

function teamMemberEntries(
    row: TimeTrackingTeamRow,
    usersById: Map<number, TimeTrackingUserRow>,
): { id: number; name: string }[] {
    return row.member_auth_user_ids.map((id) => {
        const fromRow = row.members?.find((m) => m.auth_user_id === id);
        return { id, name: resolveTeamMemberName(id, fromRow, usersById) };
    });
}

export function TimeTrackingTeamsPanel() {
    const { t } = useI18n();
    const { showAlert, showConfirm } = useAppDialog();
    const { user } = useCurrentUser();
    const canManage = canManageTimeTrackingClients(user);

    const [users, setUsers] = useState<TimeTrackingUserRow[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [teams, setTeams] = useState<TimeTrackingTeamRow[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [teamsError, setTeamsError] = useState<string | null>(null);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: TimeTrackingTeamRow | null } | null>(null);

    const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

    const partnerUsers = useMemo(
        () => users
            .filter((u) => !u.is_archived && !u.is_blocked)
            .filter((u) => isPartnerOrgRole(u.role, u.position))
            .sort((a, b) => userLabel(a).localeCompare(userLabel(b), 'ru', { sensitivity: 'base' })),
        [users],
    );

    const loadUsers = useCallback(async () => {
        setUsersLoading(true);
        setUsersError(null);
        try {
            const rows = await listTimeTrackingUsers();
            setUsers(rows);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setUsersError(t('timeTrackingPage.teams.errors.insufficientRightsView'));
            }
            else {
                setUsersError(e instanceof Error ? e.message : t('timeTrackingPage.teams.errors.loadUsersFailed'));
            }
            setUsers([]);
        }
        finally {
            setUsersLoading(false);
        }
    }, [t]);

    const loadTeams = useCallback(async (archived: boolean) => {
        setTeamsLoading(true);
        setTeamsError(null);
        try {
            const rows = await listTimeTrackingTeams({ includeArchived: archived });
            rows.sort(sortTeams);
            setTeams(rows);
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setTeamsError(t('timeTrackingPage.teams.errors.insufficientRightsView'));
            }
            else {
                setTeamsError(e instanceof Error ? e.message : t('timeTrackingPage.teams.errors.loadTeamsFailed'));
            }
            setTeams([]);
        }
        finally {
            setTeamsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        void loadTeams(includeArchived);
    }, [includeArchived, loadTeams]);

    const onSaved = (row: TimeTrackingTeamRow) => {
        setTeams((prev) => {
            const idx = prev.findIndex((x) => x.id === row.id);
            if (idx < 0) {
                const next = [...prev, row];
                next.sort(sortTeams);
                return next;
            }
            const next = [...prev];
            next[idx] = row;
            next.sort(sortTeams);
            return next;
        });
    };

    const handleDelete = async (team: TimeTrackingTeamRow) => {
        const ok = await showConfirm({
            title: t('timeTrackingPage.teams.deleteConfirm.title'),
            message: t('timeTrackingPage.teams.deleteConfirm.message').replace('{name}', team.name),
            variant: 'danger',
            confirmLabel: t('timeTrackingPage.delete'),
        });
        if (!ok)
            return;
        try {
            await deleteTimeTrackingTeam(team.id);
            setTeams((prev) => prev.filter((x) => x.id !== team.id));
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.common.deleteFailed') });
        }
    };

    const partnerName = (row: TimeTrackingTeamRow) => {
        if (row.partner_display_name?.trim())
            return row.partner_display_name.trim();
        const u = usersById.get(row.partner_auth_user_id);
        return u ? userLabel(u) : `#${row.partner_auth_user_id}`;
    };

    return (
        <div className="tt-settings__content tt-tasks-page tt-teams-page">
            <h1 className="tt-settings__page-title">{t('timeTrackingPage.teams.title')}</h1>
            <p className="tt-settings__desc tt-tasks-page__lead">
                {t('timeTrackingPage.teams.intro')}
            </p>

            <div className="tt-tasks-page__controls tt-teams-page__controls">
                <div className="tt-tasks-toolbar tt-ecat-toolbar">
                    <div className="tt-ecat-toolbar__main">
                        <div className="tt-ecat-toolbar__row">
                            <div className="tt-ecat-toolbar__toggle-field">
                                <label className="tt-ecat-archive-toggle tt-ecat-archive-toggle--toolbar tt-ecat-archive-toggle--field">
                                    <input
                                        type="checkbox"
                                        checked={includeArchived}
                                        onChange={(e) => setIncludeArchived(e.target.checked)}
                                    />
                                    <span>{t('timeTrackingPage.teams.labels.showArchived')}</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                className="tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn"
                                disabled={!canManage || usersLoading || partnerUsers.length === 0}
                                title={!canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined}
                                onClick={() => setModal({ mode: 'create', row: null })}
                            >
                                {t('timeTrackingPage.teams.cta.newTeam')}
                            </button>
                        </div>
                    </div>
                </div>

                {usersError ? (
                    <p className="tt-tasks-page__load-err" role="alert">{usersError}</p>
                ) : null}

                <div className="tt-tasks-page__notice tt-teams-page__policy">
                    <p className="tt-tasks-page__notice-title">{t('timeTrackingPage.teams.policy.title')}</p>
                    <p className="tt-tasks-page__notice-text">{t('timeTrackingPage.teams.policy.text')}</p>
                </div>
            </div>

            {!canManage && !usersLoading && users.length > 0 ? (
                <p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
                    {t('timeTrackingPage.teams.viewOnly')}
                </p>
            ) : null}

            <h2 className="tt-tasks-page__list-heading">{t('timeTrackingPage.teams.listHeading')}</h2>

            {teamsError ? (
                <p className="tt-tasks-page__load-err" role="alert">{teamsError}</p>
            ) : null}

            {!teamsError && (
                <div className="tt-settings__list tt-tasks-page__list">
                    {teamsLoading && (
                        <div className="tt-settings__list-loading" role="status">
                            {t('timeTrackingPage.teams.loading')}
                        </div>
                    )}
                    {!teamsLoading && teams.length === 0 && (
                        <div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
                            {t('timeTrackingPage.teams.empty.noTeams')}
                        </div>
                    )}
                    {!teamsLoading && teams.map((team) => {
                        const members = teamMemberEntries(team, usersById);
                        const visibleMembers = members.slice(0, 6);
                        const hiddenCount = members.length - visibleMembers.length;
                        return (
                        <div key={team.id} className="tt-settings__list-row tt-task-card tt-task-card--v2 tt-teams-card">
                            <div className="tt-task-card__body">
                                <div className="tt-task-card__line">
                                    <h3 className="tt-task-card__title">
                                        {team.name}
                                        {team.is_archived ? (
                                            <span className="tt-ecat-badge tt-ecat-badge--arch tt-ecat-badge--title" title={t('timeTrackingPage.common.archived')}>
                                                {t('timeTrackingPage.common.archive')}
                                            </span>
                                        ) : null}
                                    </h3>
                                </div>
                                <div className="tt-teams-card__meta">
                                    <span className="tt-teams-card__meta-item">
                                        <span className="tt-teams-card__meta-label">{t('timeTrackingPage.teams.labels.partner')}:</span>
                                        <span className="tt-teams-card__meta-value">{partnerName(team)}</span>
                                    </span>
                                    <span className="tt-teams-card__meta-sep" aria-hidden>·</span>
                                    <span className="tt-teams-card__meta-item">
                                        <span className="tt-teams-card__meta-value">
                                            {t('timeTrackingPage.teams.labels.membersCount').replace('{count}', String(team.member_auth_user_ids.length))}
                                        </span>
                                    </span>
                                </div>
                                <ul className="tt-teams-card__chips" aria-label={t('timeTrackingPage.teams.labels.members')}>
                                    {members.length === 0 ? (
                                        <li className="tt-teams-card__chip tt-teams-card__chip--empty">{t('timeTrackingPage.teams.labels.noMembersYet')}</li>
                                    ) : (
                                        <>
                                            {visibleMembers.map((member) => (
                                                <li key={member.id} className="tt-teams-card__chip" title={member.name}>{member.name}</li>
                                            ))}
                                            {hiddenCount > 0 ? (
                                                <li className="tt-teams-card__chip tt-teams-card__chip--more" title={members.slice(6).map((m) => m.name).join(', ')}>
                                                    +{hiddenCount}
                                                </li>
                                            ) : null}
                                        </>
                                    )}
                                </ul>
                            </div>
                            <div className="tt-task-card__actions">
                                <button
                                    type="button"
                                    className="tt-task-card__icon-btn"
                                    disabled={!canManage}
                                    aria-label={t('timeTrackingPage.teams.aria.editTeam')}
                                    title={!canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.teams.aria.editTeam')}
                                    onClick={() => setModal({ mode: 'edit', row: team })}
                                >
                                    <IcoPen />
                                </button>
                                <button
                                    type="button"
                                    className="tt-task-card__icon-btn tt-task-card__icon-btn--danger"
                                    disabled={!canManage}
                                    aria-label={t('timeTrackingPage.teams.aria.deleteTeam')}
                                    title={!canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.teams.aria.deleteTeam')}
                                    onClick={() => void handleDelete(team)}
                                >
                                    <IcoTrash />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <TeamModal
                    key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'}
                    mode={modal.mode}
                    users={users}
                    partnerUsers={partnerUsers}
                    initial={modal.row}
                    onClose={() => setModal(null)}
                    onSaved={onSaved}
                />
            )}
        </div>
    );
}
