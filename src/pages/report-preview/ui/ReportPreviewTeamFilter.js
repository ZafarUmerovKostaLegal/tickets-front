import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useMemo } from 'react';
import { SearchableSelect } from '@shared/ui';
import { partnerOptionsFromTeams, teamsForPartner, } from '../lib/reportPreviewTeamFilter';
export function ReportPreviewTeamFilter({ teams, teamsLoading = false, teamsError = null, enabled, onEnabledChange, partnerAuthUserId, onPartnerAuthUserIdChange, teamId, onTeamIdChange, canPickPartner, disabled = false, }) {
    const toggleId = useId();
    const partnerOptions = useMemo(() => partnerOptionsFromTeams(teams), [teams]);
    const partnerTeams = useMemo(() => teamsForPartner(teams, partnerAuthUserId), [teams, partnerAuthUserId]);
    const partnerItems = useMemo(() => partnerOptions.map((opt) => ({
        id: String(opt.id),
        label: opt.label,
        search: `${opt.label} ${opt.id}`.toLowerCase(),
    })), [partnerOptions]);
    const teamItems = useMemo(() => [
        { id: '', label: 'Все команды партнёра', search: 'все команды партнёра' },
        ...partnerTeams.map((team) => ({
            id: team.id,
            label: team.name,
            search: `${team.name} ${team.id}`.toLowerCase(),
        })),
    ], [partnerTeams]);
    const toggleDisabled = disabled || teamsLoading || partnerOptions.length === 0;
    const filterDisabled = disabled || !enabled || teamsLoading;
    return (_jsxs("div", { className: "tt-rp-preview__team-filter", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430", children: [_jsxs("label", { className: "tt-rp-preview__team-filter-toggle", htmlFor: toggleId, children: [_jsx("input", { id: toggleId, type: "checkbox", checked: enabled, disabled: toggleDisabled, onChange: (e) => onEnabledChange(e.target.checked) }), _jsx("span", { children: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430" })] }), enabled ? (_jsxs("div", { className: "tt-rp-preview__team-filter-controls", children: [teamsError ? (_jsx("span", { className: "tt-reports__users-filter-err", role: "status", children: teamsError })) : null, canPickPartner ? (_jsx(SearchableSelect, { portalDropdown: true, portalDropdownClassName: "tt-rp-preview__team-filter-portal", className: "tt-rp-preview__team-filter-dd", buttonClassName: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown", "aria-label": "\u041F\u0430\u0440\u0442\u043D\u0451\u0440 \u0434\u043B\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u044B", placeholder: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440\u2026", emptyListText: "\u041D\u0435\u0442 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432 \u0441 \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C\u0438", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: partnerAuthUserId > 0 ? String(partnerAuthUserId) : '', items: partnerItems, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.search, disabled: filterDisabled, onSelect: (o) => onPartnerAuthUserIdChange(Number(o.id)) })) : null, partnerTeams.length > 1 ? (_jsx(SearchableSelect, { portalDropdown: true, portalDropdownClassName: "tt-rp-preview__team-filter-portal", className: "tt-rp-preview__team-filter-dd tt-rp-preview__team-filter-dd--team", buttonClassName: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown", "aria-label": "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430", placeholder: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430\u2026", emptyListText: "\u041D\u0435\u0442 \u043A\u043E\u043C\u0430\u043D\u0434", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: teamId, items: teamItems, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.search, disabled: filterDisabled || partnerAuthUserId <= 0, onSelect: (o) => onTeamIdChange(o.id) })) : null] })) : null] }));
}
