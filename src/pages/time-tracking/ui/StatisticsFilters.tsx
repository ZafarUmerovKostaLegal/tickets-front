import { useId, useMemo, useState } from 'react';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { LaborStatisticsMeta } from '@entities/time-tracking';
import type { StatisticsLaborFilters } from './statisticsLaborTypes';
import {
    activeStatisticsFilterChips,
    patchStatisticsFilters,
    scopedStatisticsProjects,
} from './statisticsFilterScope';
import {
    detectStatisticsPeriodPreset,
    STATISTICS_PERIOD_PRESET_IDS,
    statisticsPeriodPresetRange,
    type StatisticsPeriodPresetId,
} from './statisticsPeriodPresets';
import { defaultStatisticsLaborFilters } from './statisticsLaborDefaults';

type Props = {
    filters: StatisticsLaborFilters;
    onChange: (next: StatisticsLaborFilters) => void;
    disabledPartner?: boolean;
    disabledLawyer?: boolean;
    meta: LaborStatisticsMeta | null;
};

type FilterSearchItem = {
    id: string;
    name: string;
    search: string;
};

function buildFilterItems(options: { id: string; name: string }[], allLabel: string): FilterSearchItem[] {
    const allSearch = allLabel.toLowerCase();
    return [
        { id: '', name: allLabel, search: allSearch },
        ...options.map((opt) => ({
            id: opt.id,
            name: opt.name,
            search: `${opt.name} ${opt.id}`.trim().toLowerCase(),
        })),
    ];
}

function FilterSearchableSelect({
    id,
    labelId,
    label,
    value,
    options,
    allLabel,
    onChange,
    disabled,
    noMatchText,
}: {
    id: string;
    labelId: string;
    label: string;
    value: string;
    options: { id: string; name: string }[];
    allLabel: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    noMatchText: string;
}) {
    const items = useMemo(() => buildFilterItems(options, allLabel), [options, allLabel]);

    return (
        <div className="tt-statistics__filter-field">
            <span className="tt-statistics__filter-label" id={labelId}>
                {label}
            </span>
            <SearchableSelect<FilterSearchItem>
                className={`tt-tm-dd tt-statistics__filter-dd${value ? ' tt-statistics__filter-dd--active' : ''}`}
                buttonClassName="tt-tm-dd__btn tt-statistics__filter-btn"
                buttonId={id}
                value={value}
                items={items}
                getOptionValue={(item) => item.id}
                getOptionLabel={(item) => item.name}
                getSearchText={(item) => item.search}
                onSelect={(item) => onChange(item.id)}
                placeholder={allLabel}
                emptyListText={allLabel}
                noMatchText={noMatchText}
                disabled={disabled}
                portalDropdown
                portalZIndex={11020}
                portalMinWidth={280}
                portalDropdownClassName="tsp-srch__dropdown--tall"
                aria-labelledby={labelId}
                renderOption={(item) => (
                    <span className="tt-tm-dd__opt">
                        <span className={`tt-tm-dd__opt-name${!item.id ? ' tt-tm-dd__opt-name--muted' : ''}`}>
                            {item.name}
                        </span>
                    </span>
                )}
            />
        </div>
    );
}

export function StatisticsFilters({ filters, onChange, disabledPartner, disabledLawyer, meta }: Props) {
    const { t } = useI18n();
    const base = 'timeTrackingPage.statistics.filters';
    const dateRangeId = useId();
    const [showAdvanced, setShowAdvanced] = useState(false);

    const partnerOptions = meta?.partners ?? [];
    const teamOptions = meta?.teams ?? [];
    const clientOptions = meta?.clients ?? [];
    const projectOptions = useMemo(
        () => scopedStatisticsProjects(meta, filters),
        [meta, filters],
    );
    const workTypeOptions = meta?.work_types ?? [];
    const lawyerOptions = meta?.lawyers ?? [];
    const statusOptions = meta?.project_statuses ?? [];

    const activePreset = useMemo(
        () => detectStatisticsPeriodPreset(filters.dateFrom, filters.dateTo),
        [filters.dateFrom, filters.dateTo],
    );

    const chips = useMemo(() => activeStatisticsFilterChips(filters, meta, {
        partner: t(`${base}.partner`),
        team: t(`${base}.team`),
        client: t(`${base}.client`),
        project: t(`${base}.project`),
        workType: t(`${base}.workType`),
        lawyer: t(`${base}.lawyer`),
        status: t(`${base}.projectStatus`),
        activeOnly: t(`${base}.activeProjectsOnly`),
    }), [filters, meta, t, base]);

    const patch = (partial: Partial<StatisticsLaborFilters>) => {
        onChange(patchStatisticsFilters(filters, meta, partial));
    };

    const applyPreset = (presetId: StatisticsPeriodPresetId) => {
        if (presetId === 'custom')
            return;
        const range = statisticsPeriodPresetRange(presetId);
        patch({ dateFrom: range.dateFrom, dateTo: range.dateTo });
    };

    const clearChip = (key: keyof StatisticsLaborFilters) => {
        if (key === 'activeProjectsOnly') {
            patch({ activeProjectsOnly: false });
            return;
        }
        if (key === 'partnerId' && disabledPartner)
            return;
        if (key === 'lawyerId' && disabledLawyer)
            return;
        patch({ [key]: '' } as Partial<StatisticsLaborFilters>);
    };

    const resetAll = () => {
        const defaults = defaultStatisticsLaborFilters();
        onChange({
            ...defaults,
            partnerId: disabledPartner ? filters.partnerId : '',
            lawyerId: disabledLawyer ? filters.lawyerId : '',
        });
    };

    return (
        <section className="tt-statistics__filters" aria-label={t(`${base}.aria`)}>
            <div className="tt-statistics__filters-primary">
                <div className="tt-statistics__period-presets" role="group" aria-label={t(`${base}.periodPresetsAria`)}>
                    {STATISTICS_PERIOD_PRESET_IDS.map((presetId) => (
                        <button
                            key={presetId}
                            type="button"
                            className={`tt-statistics__period-preset${activePreset === presetId ? ' tt-statistics__period-preset--active' : ''}`}
                            onClick={() => applyPreset(presetId)}
                        >
                            {t(`${base}.presets.${presetId}`)}
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`tt-statistics__period-preset${activePreset === 'custom' ? ' tt-statistics__period-preset--active' : ''}`}
                        onClick={() => setShowAdvanced(true)}
                    >
                        {t(`${base}.presets.custom`)}
                    </button>
                </div>

                <div className="tt-statistics__filters-grid tt-statistics__filters-grid--primary">
                    <FilterSearchableSelect
                        id={`${dateRangeId}-client`}
                        labelId={`${dateRangeId}-client-lbl`}
                        label={t(`${base}.client`)}
                        value={filters.clientId}
                        options={clientOptions}
                        allLabel={t(`${base}.allClients`)}
                        onChange={(clientId) => patch({ clientId })}
                        noMatchText={t('timeTrackingPage.common.clientNotFound')}
                    />
                    <FilterSearchableSelect
                        id={`${dateRangeId}-project`}
                        labelId={`${dateRangeId}-project-lbl`}
                        label={t(`${base}.project`)}
                        value={filters.projectId}
                        options={projectOptions}
                        allLabel={t(`${base}.allProjects`)}
                        onChange={(projectId) => patch({ projectId })}
                        noMatchText={t('timeTrackingPage.common.projectNotFound')}
                    />
                    <FilterSearchableSelect
                        id={`${dateRangeId}-lawyer`}
                        labelId={`${dateRangeId}-lawyer-lbl`}
                        label={t(`${base}.lawyer`)}
                        value={filters.lawyerId}
                        options={lawyerOptions}
                        allLabel={t(`${base}.allLawyers`)}
                        onChange={(lawyerId) => patch({ lawyerId })}
                        disabled={disabledLawyer}
                        noMatchText={t('timeTrackingPage.common.notFound')}
                    />
                    <FilterSearchableSelect
                        id={`${dateRangeId}-team`}
                        labelId={`${dateRangeId}-team-lbl`}
                        label={t(`${base}.team`)}
                        value={filters.teamId}
                        options={teamOptions}
                        allLabel={t(`${base}.allTeams`)}
                        onChange={(teamId) => patch({ teamId })}
                        noMatchText={t('timeTrackingPage.common.notFound')}
                    />
                </div>
            </div>

            <div className="tt-statistics__filters-toolbar">
                <button
                    type="button"
                    className="tt-statistics__filters-advanced-toggle"
                    aria-expanded={showAdvanced}
                    onClick={() => setShowAdvanced((v) => !v)}
                >
                    {showAdvanced ? t(`${base}.hideAdvanced`) : t(`${base}.showAdvanced`)}
                </button>
                <button type="button" className="tt-statistics__filters-reset" onClick={resetAll}>
                    {t(`${base}.resetAll`)}
                </button>
            </div>

            {showAdvanced ? (
                <div className="tt-statistics__filters-advanced">
                    <div className="tt-statistics__filters-grid">
                        <FilterSearchableSelect
                            id={`${dateRangeId}-partner`}
                            labelId={`${dateRangeId}-partner-lbl`}
                            label={t(`${base}.partner`)}
                            value={filters.partnerId}
                            options={partnerOptions}
                            allLabel={t(`${base}.allPartners`)}
                            onChange={(partnerId) => patch({ partnerId })}
                            disabled={disabledPartner}
                            noMatchText={t('timeTrackingPage.common.notFound')}
                        />
                        <FilterSearchableSelect
                            id={`${dateRangeId}-work-type`}
                            labelId={`${dateRangeId}-work-type-lbl`}
                            label={t(`${base}.workType`)}
                            value={filters.workTypeId}
                            options={workTypeOptions}
                            allLabel={t(`${base}.allWorkTypes`)}
                            onChange={(workTypeId) => patch({ workTypeId })}
                            noMatchText={t('timeTrackingPage.common.notFound')}
                        />
                        <FilterSearchableSelect
                            id={`${dateRangeId}-status`}
                            labelId={`${dateRangeId}-status-lbl`}
                            label={t(`${base}.projectStatus`)}
                            value={filters.projectStatusId}
                            options={statusOptions}
                            allLabel={t(`${base}.allStatuses`)}
                            onChange={(projectStatusId) => patch({ projectStatusId })}
                            noMatchText={t('timeTrackingPage.common.notFound')}
                        />
                    </div>

                    <div className="tt-statistics__filters-row">
                        <div className="tt-statistics__date-range" aria-label={t(`${base}.periodAria`)}>
                            <div className="tt-statistics__date-field">
                                <span className="tt-statistics__date-label" id={`${dateRangeId}-from`}>
                                    {t(`${base}.dateFrom`)}
                                </span>
                                <DatePicker
                                    value={filters.dateFrom}
                                    max={filters.dateTo}
                                    onChange={(dateFrom) => patch({
                                        dateFrom: dateFrom > filters.dateTo ? filters.dateTo : dateFrom,
                                    })}
                                    aria-labelledby={`${dateRangeId}-from`}
                                    portal
                                    buttonClassName="tt-statistics__date-btn"
                                />
                            </div>
                            <div className="tt-statistics__date-field">
                                <span className="tt-statistics__date-label" id={`${dateRangeId}-to`}>
                                    {t(`${base}.dateTo`)}
                                </span>
                                <DatePicker
                                    value={filters.dateTo}
                                    min={filters.dateFrom}
                                    onChange={(dateTo) => patch({
                                        dateTo: dateTo < filters.dateFrom ? filters.dateFrom : dateTo,
                                    })}
                                    aria-labelledby={`${dateRangeId}-to`}
                                    portal
                                    buttonClassName="tt-statistics__date-btn"
                                />
                            </div>
                        </div>

                        <label className="tt-statistics__active-toggle">
                            <input
                                type="checkbox"
                                checked={filters.activeProjectsOnly}
                                onChange={(e) => patch({ activeProjectsOnly: e.target.checked })}
                            />
                            <span>{t(`${base}.activeProjectsOnly`)}</span>
                        </label>
                    </div>
                </div>
            ) : null}

            {chips.length > 0 ? (
                <div className="tt-statistics__filter-chips" aria-label={t(`${base}.activeFiltersAria`)}>
                    {chips.map((chip) => (
                        <button
                            key={chip.key}
                            type="button"
                            className="tt-statistics__filter-chip"
                            onClick={() => clearChip(chip.key)}
                            title={t(`${base}.removeFilter`)}
                        >
                            <span className="tt-statistics__filter-chip-label">{chip.label}:</span>
                            <span className="tt-statistics__filter-chip-value">{chip.value}</span>
                            <span className="tt-statistics__filter-chip-x" aria-hidden>×</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
