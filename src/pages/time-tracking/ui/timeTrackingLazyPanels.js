import { jsx as _jsx } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
function TimeTrackingPanelFallback() {
    return _jsx("div", { className: "time-page__panel-fallback", "aria-busy": "true" });
}
function lazyPanel(loader, exportName) {
    return lazy(() => loader().then((m) => ({ default: m[exportName] })));
}
export const TimesheetPanel = lazyPanel(() => import('./TimesheetPanel'), 'TimesheetPanel');
export const ReportsPanel = lazyPanel(() => import('./ReportsPanel'), 'ReportsPanel');
export const ProjectsPanel = lazyPanel(() => import('./ProjectsPanel'), 'ProjectsPanel');
export const ExpensesPanel = lazyPanel(() => import('./ExpensesPanel'), 'ExpensesPanel');
export const TimeUsersPanel = lazyPanel(() => import('./TimeUsersPanel'), 'TimeUsersPanel');
export { LazyInvoicesPanel as InvoicesPanel } from '@features/invoices';
export const StatisticsPanel = lazyPanel(() => import('./StatisticsPanel'), 'StatisticsPanel');
export const TimeTrackingSettingsPanel = lazyPanel(() => import('./TimeTrackingSettingsPanel'), 'TimeTrackingSettingsPanel');
export const TimeTrackingClientsPanel = lazyPanel(() => import('./TimeTrackingClientsPanel'), 'TimeTrackingClientsPanel');
export function TimeTrackingPanelSuspense({ children }) {
    return _jsx(Suspense, { fallback: _jsx(TimeTrackingPanelFallback, {}), children: children });
}
