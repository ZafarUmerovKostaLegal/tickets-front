import { useId, useMemo } from 'react';
import type { TimeTrackingTeamRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import {
    partnerOptionsFromTeams,
    teamsForPartner,
} from '../lib/reportPreviewTeamFilter';

type PartnerPickItem = {
    id: string;
    label: string;
    search: string;
};

type TeamPickItem = {
    id: string;
    label: string;
    search: string;
};

export type ReportPreviewTeamFilterProps = {
    teams: TimeTrackingTeamRow[];
    teamsLoading?: boolean;
    teamsError?: string | null;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    partnerAuthUserId: number;
    onPartnerAuthUserIdChange: (id: number) => void;
    teamId: string;
    onTeamIdChange: (id: string) => void;
    canPickPartner: boolean;
    disabled?: boolean;
};

export function ReportPreviewTeamFilter({
    teams,
    teamsLoading = false,
    teamsError = null,
    enabled,
    onEnabledChange,
    partnerAuthUserId,
    onPartnerAuthUserIdChange,
    teamId,
    onTeamIdChange,
    canPickPartner,
    disabled = false,
}: ReportPreviewTeamFilterProps) {
    const toggleId = useId();
    const partnerOptions = useMemo(() => partnerOptionsFromTeams(teams), [teams]);
    const partnerTeams = useMemo(
        () => teamsForPartner(teams, partnerAuthUserId),
        [teams, partnerAuthUserId],
    );
    const partnerItems = useMemo<PartnerPickItem[]>(() => partnerOptions.map((opt) => ({
        id: String(opt.id),
        label: opt.label,
        search: `${opt.label} ${opt.id}`.toLowerCase(),
    })), [partnerOptions]);
    const teamItems = useMemo<TeamPickItem[]>(() => [
        { id: '', label: 'Все команды партнёра', search: 'все команды партнёра' },
        ...partnerTeams.map((team) => ({
            id: team.id,
            label: team.name,
            search: `${team.name} ${team.id}`.toLowerCase(),
        })),
    ], [partnerTeams]);
    const toggleDisabled = disabled || teamsLoading || partnerOptions.length === 0;
    const filterDisabled = disabled || !enabled || teamsLoading;

    return (<div className="tt-rp-preview__team-filter" aria-label="Фильтр по команде партнёра">
      <label className="tt-rp-preview__team-filter-toggle" htmlFor={toggleId}>
        <input id={toggleId} type="checkbox" checked={enabled} disabled={toggleDisabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        <span>Команда партнёра</span>
      </label>
      {enabled ? (
          <div className="tt-rp-preview__team-filter-controls">
              {teamsError ? (<span className="tt-reports__users-filter-err" role="status">{teamsError}</span>) : null}
              {canPickPartner ? (
                  <SearchableSelect<PartnerPickItem>
                      portalDropdown
                      portalDropdownClassName="tt-rp-preview__team-filter-portal"
                      className="tt-rp-preview__team-filter-dd"
                      buttonClassName="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown"
                      aria-label="Партнёр для фильтра команды"
                      placeholder="Партнёр…"
                      emptyListText="Нет партнёров с командами"
                      noMatchText="Не найдено"
                      value={partnerAuthUserId > 0 ? String(partnerAuthUserId) : ''}
                      items={partnerItems}
                      getOptionValue={(o) => o.id}
                      getOptionLabel={(o) => o.label}
                      getSearchText={(o) => o.search}
                      disabled={filterDisabled}
                      onSelect={(o) => onPartnerAuthUserIdChange(Number(o.id))}
                  />
              ) : null}
              {partnerTeams.length > 1 ? (
                  <SearchableSelect<TeamPickItem>
                      portalDropdown
                      portalDropdownClassName="tt-rp-preview__team-filter-portal"
                      className="tt-rp-preview__team-filter-dd tt-rp-preview__team-filter-dd--team"
                      buttonClassName="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown"
                      aria-label="Команда партнёра"
                      placeholder="Команда…"
                      emptyListText="Нет команд"
                      noMatchText="Не найдено"
                      value={teamId}
                      items={teamItems}
                      getOptionValue={(o) => o.id}
                      getOptionLabel={(o) => o.label}
                      getSearchText={(o) => o.search}
                      disabled={filterDisabled || partnerAuthUserId <= 0}
                      onSelect={(o) => onTeamIdChange(o.id)}
                  />
              ) : null}
          </div>
      ) : null}
    </div>);
}
