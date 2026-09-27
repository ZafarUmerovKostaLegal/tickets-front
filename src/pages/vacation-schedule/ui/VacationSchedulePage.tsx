import { useCallback, useState } from 'react';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import type { VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';
import { VacationEmployeeSidebar } from './VacationEmployeeSidebar';
import './VacationSchedulePage.css';

export function VacationSchedulePage() {
    const [selectedEmployees, setSelectedEmployees] = useState<VacationScheduleEmployeeRow[]>([]);
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
                </header>
                <div className="vacation-schedule-page__body">
                    <VacationEmployeeSidebar
                        selectedIds={selectedIds}
                        onSelectEmployees={onSelectEmployees}
                        onToggleEmployee={onToggleEmployee}
                    />
                </div>
            </main>
        </div>
    );
}
