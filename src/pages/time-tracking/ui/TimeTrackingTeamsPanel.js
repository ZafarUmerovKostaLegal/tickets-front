import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './TimeTrackingForms.css';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createTimeTrackingTeam, deleteTimeTrackingTeam, isForbiddenError, listTimeTrackingTeams, listTimeTrackingUsers, patchTimeTrackingTeam, firstNonStubUserText, pickUserDisplayLabel, } from '@entities/time-tracking';
import { canManageTimeTrackingClients } from '@entities/time-tracking/model/timeTrackingAccess';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { SearchableSelect, useAppDialog } from '@shared/ui';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import './TimeTrackingTeamsPanel.css';
const IcoPen = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
const IcoTrash = () => (_jsxs("svg", { className: "tt-task-card__btn-ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }));
function userLabel(u) {
    return pickUserDisplayLabel(u.display_name, u.email, u.id);
}
function resolveTeamMemberName(id, fromRow, usersById) {
    const fromCatalog = usersById.get(id);
    return pickUserDisplayLabel(firstNonStubUserText(fromCatalog?.display_name, fromRow?.display_name), firstNonStubUserText(fromCatalog?.email, fromRow?.email), id);
}
function userSearchText(u) {
    return [u.display_name, u.email, u.position, String(u.id)].filter(Boolean).join(' ').trim();
}
function sortTeams(a, b) {
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
}
function emptyTeamForm(partnerId = '') {
    return {
        name: '',
        partnerId,
        memberIds: [],
        isArchived: false,
    };
}
function rowToTeamForm(row) {
    return {
        name: row.name,
        partnerId: String(row.partner_auth_user_id),
        memberIds: [...row.member_auth_user_ids],
        isArchived: row.is_archived,
    };
}
function TeamModal({ mode, users, partnerUsers, initial, onClose, onSaved }) {
    const { t } = useI18n();
    const uid = useId();
    const [form, setForm] = useState(() => (initial ? rowToTeamForm(initial) : emptyTeamForm(partnerUsers[0] ? String(partnerUsers[0].id) : '')));
    const [memberSearch, setMemberSearch] = useState('');
    const [error, setError] = useState(null);
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
    const toggleMember = (id) => {
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
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--task tt-tm-modal--team", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-team-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-team-title`, className: "tt-tm-modal__title", children: mode === 'create'
                                ? t('timeTrackingPage.teams.modal.createTitle')
                                : t('timeTrackingPage.teams.modal.editTitle') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-team-name`, children: [t('timeTrackingPage.teams.labels.name'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-team-name`, className: "tt-tm-input", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", id: `${uid}-partner-lbl`, children: [t('timeTrackingPage.teams.labels.partner'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-partner`, value: form.partnerId, items: partnerUsers, getOptionValue: (u) => String(u.id), getOptionLabel: userLabel, getSearchText: userSearchText, onSelect: (u) => setForm((f) => ({ ...f, partnerId: String(u.id) })), placeholder: t('timeTrackingPage.teams.labels.selectPartner'), emptyListText: t('timeTrackingPage.teams.labels.noPartners'), noMatchText: t('timeTrackingPage.common.notFound'), disabled: partnerUsers.length === 0, portalDropdown: true, portalZIndex: 11020, portalMinWidth: 320, "aria-labelledby": `${uid}-partner-lbl`, renderOption: (u) => (_jsxs("span", { className: "tt-tm-dd__opt", children: [_jsx("span", { className: "tt-tm-dd__opt-name", children: userLabel(u) }), u.position ? _jsx("span", { className: "tt-tm-dd__opt-sub", children: u.position }) : null] })) })] }), _jsxs("div", { className: "tt-tm-field tt-teams-member-field", children: [_jsxs("div", { className: "tt-teams-member-field__toolbar", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-member-search`, children: t('timeTrackingPage.teams.labels.members') }), _jsx("span", { className: "tt-teams-member-field__count", children: t('timeTrackingPage.teams.labels.membersSelected').replace('{count}', String(form.memberIds.length)) })] }), _jsx("input", { id: `${uid}-member-search`, className: "tt-tm-input", value: memberSearch, onChange: (e) => setMemberSearch(e.target.value), placeholder: t('timeTrackingPage.teams.labels.memberSearchPlaceholder') }), _jsx("div", { className: "tt-teams-member-picker", role: "group", "aria-label": t('timeTrackingPage.teams.labels.members'), children: memberCandidates.length === 0 ? (_jsx("p", { className: "tt-tm-hint tt-teams-member-picker__empty", children: t('timeTrackingPage.teams.labels.noMembers') })) : memberCandidates.map((u) => (_jsxs("label", { className: "tt-teams-member-picker__row", children: [_jsx("input", { type: "checkbox", className: "tt-teams-member-picker__check", checked: form.memberIds.includes(u.id), onChange: () => toggleMember(u.id) }), _jsxs("span", { className: "tt-teams-member-picker__body", children: [_jsx("span", { className: "tt-teams-member-picker__name", children: userLabel(u) }), u.position ? (_jsx("span", { className: "tt-teams-member-picker__sub", children: u.position })) : null, u.email ? (_jsx("span", { className: "tt-teams-member-picker__email", children: u.email })) : null] })] }, u.id))) })] }), mode === 'edit' && (_jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: form.isArchived, onChange: (e) => setForm((f) => ({ ...f, isArchived: e.target.checked })) }), _jsx("span", { children: t('timeTrackingPage.common.archived') })] })), error ? (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error })) : null] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving, onClick: () => void handleSubmit(), children: saving
                                ? t('timeTrackingPage.saving')
                                : mode === 'create'
                                    ? t('timeTrackingPage.common.create')
                                    : t('timeTrackingPage.save') })] })] }) }));
}
function teamMemberEntries(row, usersById) {
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
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState(null);
    const [teams, setTeams] = useState([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [teamsError, setTeamsError] = useState(null);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [modal, setModal] = useState(null);
    const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
    const partnerUsers = useMemo(() => users
        .filter((u) => !u.is_archived && !u.is_blocked)
        .filter((u) => isPartnerOrgRole(u.role, u.position))
        .sort((a, b) => userLabel(a).localeCompare(userLabel(b), 'ru', { sensitivity: 'base' })), [users]);
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
    const loadTeams = useCallback(async (archived) => {
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
    const onSaved = (row) => {
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
    const handleDelete = async (team) => {
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
    const partnerName = (row) => {
        if (row.partner_display_name?.trim())
            return row.partner_display_name.trim();
        const u = usersById.get(row.partner_auth_user_id);
        return u ? userLabel(u) : `#${row.partner_auth_user_id}`;
    };
    return (_jsxs("div", { className: "tt-settings__content tt-tasks-page tt-teams-page", children: [_jsx("h1", { className: "tt-settings__page-title", children: t('timeTrackingPage.teams.title') }), _jsx("p", { className: "tt-settings__desc tt-tasks-page__lead", children: t('timeTrackingPage.teams.intro') }), _jsxs("div", { className: "tt-tasks-page__controls tt-teams-page__controls", children: [_jsx("div", { className: "tt-tasks-toolbar tt-ecat-toolbar", children: _jsx("div", { className: "tt-ecat-toolbar__main", children: _jsxs("div", { className: "tt-ecat-toolbar__row", children: [_jsx("div", { className: "tt-ecat-toolbar__toggle-field", children: _jsxs("label", { className: "tt-ecat-archive-toggle tt-ecat-archive-toggle--toolbar tt-ecat-archive-toggle--field", children: [_jsx("input", { type: "checkbox", checked: includeArchived, onChange: (e) => setIncludeArchived(e.target.checked) }), _jsx("span", { children: t('timeTrackingPage.teams.labels.showArchived') })] }) }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary tt-ecat-toolbar__new-btn", disabled: !canManage || usersLoading || partnerUsers.length === 0, title: !canManage ? t('timeTrackingPage.common.manageRoleHint') : undefined, onClick: () => setModal({ mode: 'create', row: null }), children: t('timeTrackingPage.teams.cta.newTeam') })] }) }) }), usersError ? (_jsx("p", { className: "tt-tasks-page__load-err", role: "alert", children: usersError })) : null, _jsxs("div", { className: "tt-tasks-page__notice tt-teams-page__policy", children: [_jsx("p", { className: "tt-tasks-page__notice-title", children: t('timeTrackingPage.teams.policy.title') }), _jsx("p", { className: "tt-tasks-page__notice-text", children: t('timeTrackingPage.teams.policy.text') })] })] }), !canManage && !usersLoading && users.length > 0 ? (_jsx("p", { className: "tt-settings__banner-info tt-tasks-page__banner", role: "status", children: t('timeTrackingPage.teams.viewOnly') })) : null, _jsx("h2", { className: "tt-tasks-page__list-heading", children: t('timeTrackingPage.teams.listHeading') }), teamsError ? (_jsx("p", { className: "tt-tasks-page__load-err", role: "alert", children: teamsError })) : null, !teamsError && (_jsxs("div", { className: "tt-settings__list tt-tasks-page__list", children: [teamsLoading && (_jsx("div", { className: "tt-settings__list-loading", role: "status", children: t('timeTrackingPage.teams.loading') })), !teamsLoading && teams.length === 0 && (_jsx("div", { className: "tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty", children: t('timeTrackingPage.teams.empty.noTeams') })), !teamsLoading && teams.map((team) => {
                        const members = teamMemberEntries(team, usersById);
                        const visibleMembers = members.slice(0, 6);
                        const hiddenCount = members.length - visibleMembers.length;
                        return (_jsxs("div", { className: "tt-settings__list-row tt-task-card tt-task-card--v2 tt-teams-card", children: [_jsxs("div", { className: "tt-task-card__body", children: [_jsx("div", { className: "tt-task-card__line", children: _jsxs("h3", { className: "tt-task-card__title", children: [team.name, team.is_archived ? (_jsx("span", { className: "tt-ecat-badge tt-ecat-badge--arch tt-ecat-badge--title", title: t('timeTrackingPage.common.archived'), children: t('timeTrackingPage.common.archive') })) : null] }) }), _jsxs("div", { className: "tt-teams-card__meta", children: [_jsxs("span", { className: "tt-teams-card__meta-item", children: [_jsxs("span", { className: "tt-teams-card__meta-label", children: [t('timeTrackingPage.teams.labels.partner'), ":"] }), _jsx("span", { className: "tt-teams-card__meta-value", children: partnerName(team) })] }), _jsx("span", { className: "tt-teams-card__meta-sep", "aria-hidden": true, children: "\u00B7" }), _jsx("span", { className: "tt-teams-card__meta-item", children: _jsx("span", { className: "tt-teams-card__meta-value", children: t('timeTrackingPage.teams.labels.membersCount').replace('{count}', String(team.member_auth_user_ids.length)) }) })] }), _jsx("ul", { className: "tt-teams-card__chips", "aria-label": t('timeTrackingPage.teams.labels.members'), children: members.length === 0 ? (_jsx("li", { className: "tt-teams-card__chip tt-teams-card__chip--empty", children: t('timeTrackingPage.teams.labels.noMembersYet') })) : (_jsxs(_Fragment, { children: [visibleMembers.map((member) => (_jsx("li", { className: "tt-teams-card__chip", title: member.name, children: member.name }, member.id))), hiddenCount > 0 ? (_jsxs("li", { className: "tt-teams-card__chip tt-teams-card__chip--more", title: members.slice(6).map((m) => m.name).join(', '), children: ["+", hiddenCount] })) : null] })) })] }), _jsxs("div", { className: "tt-task-card__actions", children: [_jsx("button", { type: "button", className: "tt-task-card__icon-btn", disabled: !canManage, "aria-label": t('timeTrackingPage.teams.aria.editTeam'), title: !canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.teams.aria.editTeam'), onClick: () => setModal({ mode: 'edit', row: team }), children: _jsx(IcoPen, {}) }), _jsx("button", { type: "button", className: "tt-task-card__icon-btn tt-task-card__icon-btn--danger", disabled: !canManage, "aria-label": t('timeTrackingPage.teams.aria.deleteTeam'), title: !canManage ? t('timeTrackingPage.common.insufficientRights') : t('timeTrackingPage.teams.aria.deleteTeam'), onClick: () => void handleDelete(team), children: _jsx(IcoTrash, {}) })] })] }, team.id));
                    })] })), modal && (_jsx(TeamModal, { mode: modal.mode, users: users, partnerUsers: partnerUsers, initial: modal.row, onClose: () => setModal(null), onSaved: onSaved }, modal.mode === 'edit' && modal.row ? modal.row.id : 'create'))] }));
}
