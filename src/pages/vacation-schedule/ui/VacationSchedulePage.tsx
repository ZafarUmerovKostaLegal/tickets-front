import { useState } from 'react';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import type { VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';
import { VacationEmployeeSidebar } from './VacationEmployeeSidebar';
import './VacationSchedulePage.css';

export function VacationSchedulePage() {
    const [selectedEmployee, setSelectedEmployee] = useState<VacationScheduleEmployeeRow | null>(null);

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
                        selectedId={selectedEmployee?.id ?? null}
                        onSelect={setSelectedEmployee}
                    />
                </div>
            </main>
        </div>
    );
}
