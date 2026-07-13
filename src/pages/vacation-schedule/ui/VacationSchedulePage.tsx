import { useEffect, useMemo, useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { canDecideVacationLeaveRequests, canViewVacationAttendanceStats } from '../model/vacationScheduleAccess';
import { VacationAbsenceRequestModal } from './VacationAbsenceRequestModal';
import { VacationAttendanceStatsPanel } from './VacationAttendanceStatsPanel';
import { VacationScheduleGrid, type VacationScheduleHeaderActions } from './VacationScheduleGrid';
import { VacationScheduleHeaderMenu } from './VacationScheduleHeaderMenu';
import { VacationLeaveRequestsPanel } from './VacationLeaveRequestsPanel';
import './VacationSchedulePage.css';

type Tab = 'schedule' | 'mine' | 'to_decide' | 'stats';

export function VacationSchedulePage() {
    const { user, loading } = useCurrentUser();
    const canDecideRequests = useMemo(
        () => !loading && canDecideVacationLeaveRequests(user),
        [loading, user],
    );
    const canViewAttendanceStats = useMemo(
        () => !loading && canViewVacationAttendanceStats(user),
        [loading, user],
    );
    const [activeTab, setActiveTab] = useState<Tab>('schedule');
    const [headerActions, setHeaderActions] = useState<VacationScheduleHeaderActions | null>(null);
    const [requestModalOpen, setRequestModalOpen] = useState(false);

    const [refreshToken, setRefreshToken] = useState(0);
    const bumpRefresh = () => setRefreshToken((t) => t + 1);

    useEffect(() => {
        if (!canDecideRequests && activeTab === 'to_decide')
            setActiveTab('schedule');
        if (!canViewAttendanceStats && activeTab === 'stats')
            setActiveTab('schedule');
    }, [canDecideRequests, canViewAttendanceStats, activeTab]);

    const tabs: ReadonlyArray<{ id: Tab; label: string; visible: boolean }> = [
        { id: 'schedule', label: 'График', visible: true },
        { id: 'mine', label: 'Мои заявки', visible: true },
        { id: 'to_decide', label: 'На согласование', visible: canDecideRequests },
        { id: 'stats', label: 'Статистика', visible: canViewAttendanceStats },
    ];

    return (
        <div className="vacation-schedule-page">
            <main className="vacation-schedule-page__main">
                <header className="vacation-schedule-page__header">
                    <div className="vacation-schedule-page__header-start">
                        <AppBackButton className="app-back-btn" />
                        <AppHomeLogo withSeparator />
                        <h1 className="vacation-schedule-page__title">График отпусков</h1>
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
                    {tabs.filter((t) => t.visible).map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                className={`vac-tabs__tab${active ? ' vac-tabs__tab--on' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

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
                        {activeTab === 'stats' && canViewAttendanceStats && (
                            <VacationAttendanceStatsPanel externalRefreshToken={refreshToken} />
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
