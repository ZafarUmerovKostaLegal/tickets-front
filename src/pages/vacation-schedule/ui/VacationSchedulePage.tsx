import { useCallback, useState } from 'react';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import type { VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';
import { VacationAbsenceRequestModal } from './VacationAbsenceRequestModal';
import { VacationEmployeeSidebar } from './VacationEmployeeSidebar';
import { VacationYearCalendar } from './VacationYearCalendar';
import './VacationSchedulePage.css';

export function VacationSchedulePage() {
    const [selectedEmployees, setSelectedEmployees] = useState<VacationScheduleEmployeeRow[]>([]);
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const selectedIds = new Set(selectedEmployees.map((row) => row.id));

    const onSelectEmployees = useCallback((employees: VacationScheduleEmployeeRow[]) => {
        setSelectedEmployees(employees);
    }, []);

    const onToggleEmployee = useCallback((employee: VacationScheduleEmployeeRow) => {
        setSelectedEmployees((prev) => (
            prev.some((row) => row.id === employee.id)
                ? prev.filter((row) => row.id !== employee.id)
                : [...prev, employee]
        ));
    }, []);

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
                    </div>
                </header>
                <div className="vacation-schedule-page__body">
                    <VacationEmployeeSidebar
                        selectedIds={selectedIds}
                        onSelectEmployees={onSelectEmployees}
                        onToggleEmployee={onToggleEmployee}
                    />
                    <VacationYearCalendar />
                </div>
            </main>
            <VacationAbsenceRequestModal
                open={requestModalOpen}
                onClose={() => setRequestModalOpen(false)}
            />
        </div>
    );
}
