import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { useVacationLeavePendingBadge } from '@entities/vacation';
import { canDecideVacationLeaveRequests } from '../model/vacationScheduleAccess';
import { VacationAbsenceRequestModal } from './VacationAbsenceRequestModal';
import { VacationScheduleGrid, type VacationScheduleHeaderActions } from './VacationScheduleGrid';
import { VacationScheduleHeaderMenu } from './VacationScheduleHeaderMenu';
import { VacationLeaveRequestsPanel } from './VacationLeaveRequestsPanel';
import './VacationSchedulePage.css';

type Tab = 'schedule' | 'mine' | 'to_decide';

const TAB_IDS = new Set<Tab>(['schedule', 'mine', 'to_decide']);

function parseVacationTabParam(raw: string | null): Tab | null {
    if (!raw)
        return null;
    return TAB_IDS.has(raw as Tab) ? raw as Tab : null;
}

export function VacationSchedulePage() {
    const { t } = useI18n();
    const { user, loading } = useCurrentUser();
    const [searchParams, setSearchParams] = useSearchParams();
    const canDecideRequests = useMemo(
        () => !loading && canDecideVacationLeaveRequests(user),
        [loading, user],
    );
    const { counts, badge: navBadge, toDecideBadge, minePendingBadge } = useVacationLeavePendingBadge(!loading);
    const [activeTab, setActiveTab] = useState<Tab>(() => parseVacationTabParam(searchParams.get('tab')) ?? 'schedule');
    const [headerActions, setHeaderActions] = useState<VacationScheduleHeaderActions | null>(null);
    const [requestModalOpen, setRequestModalOpen] = useState(false);

    const [refreshToken, setRefreshToken] = useState(0);
    const bumpRefresh = () => setRefreshToken((v) => v + 1);

    useEffect(() => {
        const fromUrl = parseVacationTabParam(searchParams.get('tab'));
        if (fromUrl && fromUrl !== activeTab)
            setActiveTab(fromUrl);
    }, [searchParams]);

    useEffect(() => {
        if (!canDecideRequests && activeTab === 'to_decide')
            setActiveTab('schedule');
    }, [canDecideRequests, activeTab]);

    useEffect(() => {
        if (loading)
            return;
        const urlTab = searchParams.get('tab');
        if (urlTab === activeTab)
            return;
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', activeTab);
            return next;
        }, { replace: true });
    }, [activeTab, loading, searchParams, setSearchParams]);

    const selectTab = (tab: Tab) => {
        setActiveTab(tab);
    };

    const tabs: ReadonlyArray<{ id: Tab; label: string; visible: boolean; badge?: string; badgeAria?: string }> = [
        { id: 'schedule', label: 'График', visible: true },
        {
            id: 'mine',
            label: 'Мои заявки',
            visible: true,
            badge: minePendingBadge || undefined,
            badgeAria: counts.minePendingCount > 0
                ? t('homeHub.vacationMinePendingBadgeAria').replace('{count}', String(counts.minePendingCount))
                : undefined,
        },
        {
            id: 'to_decide',
            label: 'На согласование',
            visible: canDecideRequests,
            badge: toDecideBadge || undefined,
            badgeAria: counts.toDecideCount > 0
                ? t('homeHub.vacationToDecideBadgeAria').replace('{count}', String(counts.toDecideCount))
                : undefined,
        },
    ];

    const showToDecideAttention = activeTab === 'schedule'
        && canDecideRequests
        && counts.toDecideCount > 0;
    const showMinePendingAttention = activeTab === 'schedule'
        && counts.minePendingCount > 0;

    return (
        <div className="vacation-schedule-page">
            <main className="vacation-schedule-page__main">
                <header className="vacation-schedule-page__header">
                    <div className="vacation-schedule-page__header-start">
                        <AppBackButton className="app-back-btn" />
                        <AppHomeLogo withSeparator />
                        <h1 className="vacation-schedule-page__title">
                            График отпусков
                            {navBadge ? (
                                <span
                                    className="vacation-schedule-page__title-badge"
                                    aria-label={t('homeHub.vacationToDecideBadgeAria').replace('{count}', String(counts.count))}
                                >
                                    {navBadge}
                                </span>
                            ) : null}
                        </h1>
                    </div>
                    <div className="app-page-header-end">
                        <button
                            type="button"
                            className="vac-page-add-btn"
                            onClick={() => setRequestModalOpen(true)}
                            aria-label="Новая заявка на отсутствие"
                            title="Новая заявка"
                        >
                            +
                        </button>
                        {activeTab === 'schedule' && headerActions ? (
                            <VacationScheduleHeaderMenu
                                canManage={headerActions.canManage}
                                onAddEmployee={headerActions.onAddEmployee}
                                payrollShowColumns={headerActions.payrollShowColumns}
                                onPayrollToggle={headerActions.onPayrollToggle}
                                onPayrollParams={headerActions.onPayrollParams}
                            />
                        ) : null}
                        <AppPageSettings />
                    </div>
                </header>

                <nav className="vac-tabs" role="tablist" aria-label="Разделы графика отпусков">
                    {tabs.filter((tab) => tab.visible).map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                className={`vac-tabs__tab${active ? ' vac-tabs__tab--on' : ''}`}
                                onClick={() => selectTab(tab.id)}
                                aria-label={tab.badgeAria ? `${tab.label}. ${tab.badgeAria}` : undefined}
                            >
                                <span className="vac-tabs__tab-inner">
                                    {tab.label}
                                    {tab.badge ? (
                                        <span className="vac-tabs__tab-badge" aria-hidden>{tab.badge}</span>
                                    ) : null}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {showToDecideAttention ? (
                    <div className="vac-attention" role="status">
                        <p className="vac-attention__text">
                            {t('vacationSchedule.attention.toDecide')
                                .replace('{count}', String(counts.toDecideCount))}
                        </p>
                        <button
                            type="button"
                            className="vac-attention__action"
                            onClick={() => selectTab('to_decide')}
                        >
                            {t('vacationSchedule.attention.goToDecide')}
                        </button>
                    </div>
                ) : showMinePendingAttention ? (
                    <div className="vac-attention vac-attention--info" role="status">
                        <p className="vac-attention__text">
                            {t('vacationSchedule.attention.minePending')
                                .replace('{count}', String(counts.minePendingCount))}
                        </p>
                        <button
                            type="button"
                            className="vac-attention__action"
                            onClick={() => selectTab('mine')}
                        >
                            {t('vacationSchedule.attention.goToMine')}
                        </button>
                    </div>
                ) : null}

                <div className="vacation-schedule-page__content">
                    <div className="vacation-schedule-page__inner">
                        {activeTab === 'schedule' && (
                            <VacationScheduleGrid
                                onHeaderActionsChange={setHeaderActions}
                                externalRefreshToken={refreshToken}
                            />
                        )}
                        {activeTab === 'mine' && (
                            <VacationLeaveRequestsPanel
                                mode="mine"
                                refreshToken={refreshToken}
                                onScheduleMayHaveChanged={bumpRefresh}
                            />
                        )}
                        {activeTab === 'to_decide' && canDecideRequests && (
                            <VacationLeaveRequestsPanel
                                mode="to_decide"
                                refreshToken={refreshToken}
                                onScheduleMayHaveChanged={bumpRefresh}
                            />
                        )}
                    </div>
                </div>
            </main>

            <VacationAbsenceRequestModal
                open={requestModalOpen}
                onClose={() => setRequestModalOpen(false)}
                onSubmitted={() => {
                    bumpRefresh();
                    setActiveTab('mine');
                }}
            />
        </div>
    );
}
