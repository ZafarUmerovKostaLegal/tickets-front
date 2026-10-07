import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { routes } from '@shared/config';
import { ProtectedRoute } from '@app/ProtectedRoute';
import { GuestOnlyRoute } from '@app/GuestOnlyRoute';
import { PageTransition } from '@app/PageTransition';
import { DocumentTitle } from '@app/ui/DocumentTitle';
import { TimeTrackingRoute } from '@app/TimeTrackingRoute';
import { ExpensesAccessRoute } from '@app/ExpensesAccessRoute';
import { AttendanceAccessRoute } from '@app/AttendanceAccessRoute';
import { AccountingAccessRoute } from '@app/AccountingAccessRoute';
import { AdminOnlyModuleRoute } from '@app/AdminOnlyModuleRoute';
import { ExpensesMgmtRoute } from '@app/ExpensesMgmtRoute';
import { ExpensesNestedLayout } from '@app/ExpensesNestedLayout';
import { ExpensesErrorFallback } from '@pages/expenses/ui/ExpensesErrorFallback';
import { AppRouteError } from '@app/ui/AppRouteError';
import { DesktopOnlyRoute } from '@app/DesktopOnlyRoute';
import { EnsureContactsI18n, EnsureTimeTrackingI18n, EnsureTodoI18n } from '@shared/i18n';
function routerBasename() {
    const b = import.meta.env.BASE_URL;
    if (b == null || b === '' || b === '/' || b === './')
        return undefined;
    const t = String(b).replace(/\/$/, '');
    if (t === '' || t === '.')
        return undefined;
    return t.startsWith('/') ? t : `/${t}`;
}
const LoginPage = lazy(() => import('@pages/login').then(m => ({ default: m.LoginPage })));
const AuthCallbackPage = lazy(() => import('@pages/auth-callback').then(m => ({ default: m.AuthCallbackPage })));
const HomePage = lazy(() => import('@pages/home').then(m => ({ default: m.HomePage })));
const TicketsPage = lazy(() => import('@pages/tickets').then(m => ({ default: m.TicketsPage })));
const AdminPage = lazy(() => import('@pages/admin').then(m => ({ default: m.AdminPage })));
const NetworkDriveAccessPage = lazy(() => import('@pages/network-drive').then(m => ({ default: m.NetworkDriveAccessPage })));
const AttendancePage = lazy(() => import('@pages/attendance').then(m => ({ default: m.AttendancePage })));
const VacationSchedulePage = lazy(() => import('@pages/vacation-schedule').then(m => ({ default: m.VacationSchedulePage })));
const CallSchedulePage = lazy(() => import('@pages/call-schedule').then(m => ({ default: m.CallSchedulePage })));
const CorrespondencePage = lazy(() => import('@pages/correspondence').then(m => ({ default: m.CorrespondencePage })));
const OutgoingLetterCreatePage = lazy(() => import('@pages/correspondence/ui/OutgoingLetterCreatePage').then(m => ({ default: m.OutgoingLetterCreatePage })));
const OutgoingLetterPreviewPage = lazy(() => import('@pages/correspondence/ui/OutgoingLetterPreviewPage').then(m => ({ default: m.OutgoingLetterPreviewPage })));
const AccountingPage = lazy(() => import('@pages/accounting').then(m => ({ default: m.AccountingPage })));
const InventoryPage = lazy(() => import('@pages/inventory').then(m => ({ default: m.InventoryPage })));
const ProjectDetailPage = lazy(() => import('@pages/project-detail').then(m => ({ default: m.ProjectDetailPage })));
const TimeTrackingNewProjectPage = lazy(() => import('@pages/time-tracking/ui/TimeTrackingNewProjectPage').then(m => ({ default: m.TimeTrackingNewProjectPage })));
const InvoiceCreatePage = lazy(() => import('@pages/time-tracking/ui/InvoiceCreatePage').then(m => ({ default: m.InvoiceCreatePage })));
const InvoiceDetailPage = lazy(() => import('@pages/time-tracking/ui/InvoiceDetailPage').then(m => ({ default: m.InvoiceDetailPage })));
const TicketDetailPage = lazy(() => import('@pages/ticket-detail').then(m => ({ default: m.TicketDetailPage })));
const UserEditPage = lazy(() => import('@pages/user-edit').then(m => ({ default: m.UserEditPage })));
const TodoPage = lazy(() => import('@pages/todo').then(m => ({ default: m.TodoPage })));
const RulesPage = lazy(() => import('@pages/rules').then(m => ({ default: m.RulesPage })));
const HelpPage = lazy(() => import('@pages/help').then(m => ({ default: m.HelpPage })));
const KostaDailyPage = lazy(() => import('@pages/kosta-daily').then(m => ({ default: m.KostaDailyPage })));
const ContactsPage = lazy(() => import('@pages/contacts').then(m => ({ default: m.ContactsPage })));
const InternalCommunicationPage = lazy(() => import('@pages/internal-communication').then(m => ({ default: m.InternalCommunicationPage })));
const ExpensesPage = lazy(() => import('@pages/expenses/ui/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const ExpensesRequestsPage = lazy(() => import('@pages/expenses/ui/ExpensesRequestsPage').then(m => ({ default: m.ExpensesRequestsPage })));
const ExpensesReportPage = lazy(() => import('@pages/expenses/ui/ExpensesReportPage').then(m => ({ default: m.ExpensesReportPage })));
const ClientExpensesPage = lazy(() => import('@pages/expenses/ui/ClientExpensesPage').then(m => ({ default: m.ClientExpensesPage })));
const PartnerExpensesPage = lazy(() => import('@pages/expenses/ui/PartnerExpensesPage').then(m => ({ default: m.PartnerExpensesPage })));
const PartnerExpensesReportPage = lazy(() => import('@pages/expenses/ui/PartnerExpensesReportPage').then(m => ({ default: m.PartnerExpensesReportPage })));
const ExpensesCashPage = lazy(() => import('@pages/expenses/ui/ExpensesCashPage').then(m => ({ default: m.ExpensesCashPage })));
const InvoicePreviewRouteLazy = lazy(() => import('@app/InvoicePreviewRoute').then(m => ({ default: m.InvoicePreviewRoute })));
const ReportPreviewRouteLazy = lazy(() => import('@app/ReportPreviewRoute').then(m => ({ default: m.ReportPreviewRoute })));
function LazyFallback() {
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', minHeight: '60vh' }, children: _jsx("div", { className: "app-splash__progress-wrap", style: { opacity: 0.5 }, children: _jsxs("svg", { className: "app-splash__progress-ring", viewBox: "0 0 36 36", width: 36, height: 36, children: [_jsx("circle", { className: "app-splash__progress-bg", cx: "18", cy: "18", r: "15.9" }), _jsx("circle", { className: "app-splash__progress-fill", cx: "18", cy: "18", r: "15.9", strokeDasharray: "30 100", transform: "rotate(-90 18 18)" })] }) }) }));
}
function withGuest(children) {
    return (_jsx(PageTransition, { children: _jsx(GuestOnlyRoute, { children: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: children }) }) }));
}
function withProtected(children, adminOnly = false) {
    return (_jsx(PageTransition, { children: _jsx(ProtectedRoute, { adminOnly: adminOnly, children: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: children }) }) }));
}
function AppShellOutlet() {
    return (_jsxs(_Fragment, { children: [_jsx(DocumentTitle, {}), _jsx(Outlet, {})] }));
}
const router = createBrowserRouter([
    {
        element: _jsx(AppShellOutlet, {}),
        errorElement: _jsx(AppRouteError, {}),
        children: [
            { path: routes.login, element: withGuest(_jsx(LoginPage, {})) },
            { path: routes.authCallback, element: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(AuthCallbackPage, {}) }) },
            { path: routes.home, element: withProtected(_jsx(HomePage, {})) },
            { path: routes.kostaLegalAi, element: withProtected(_jsx(HomePage, {})) },
            { path: routes.tickets, element: withProtected(_jsx(TicketsPage, {})) },
            { path: routes.ticketDetail, element: withProtected(_jsx(TicketDetailPage, {})) },
            { path: routes.attendance, element: withProtected(_jsx(AttendanceAccessRoute, { children: _jsx(AttendancePage, {}) })) },
            { path: routes.vacationSchedule, element: withProtected(_jsx(VacationSchedulePage, {})) },
            { path: routes.callSchedule, element: withProtected(_jsx(CallSchedulePage, {})) },
            { path: routes.correspondence, element: withProtected(_jsx(CorrespondencePage, {})) },
            { path: routes.correspondenceOutgoingCreate, element: withProtected(_jsx(OutgoingLetterCreatePage, {})) },
            { path: routes.correspondenceOutgoingPreview, element: withProtected(_jsx(OutgoingLetterPreviewPage, {})) },
            { path: routes.accounting, element: withProtected(_jsx(AccountingAccessRoute, { children: _jsx(EnsureTimeTrackingI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(AccountingPage, {}) }) })) },
            { path: routes.inventory, element: withProtected(_jsx(InventoryPage, {})) },
            { path: routes.timeTracking, element: withProtected(_jsx(TimeTrackingRoute, {})) },
            { path: routes.timeTrackingNewProject, element: withProtected(_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(TimeTrackingNewProjectPage, {}) })) },
            { path: routes.timeTrackingReportPreview, element: withProtected(_jsx(ReportPreviewRouteLazy, {})) },
            { path: routes.timeTrackingInvoicePreview, element: withProtected(_jsx(InvoicePreviewRouteLazy, {})) },
            { path: routes.timeTrackingInvoiceCreate, element: withProtected(_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(InvoiceCreatePage, {}) })) },
            { path: routes.timeTrackingInvoiceDetail, element: withProtected(_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(InvoiceDetailPage, {}) })) },
            { path: routes.projectDetail, element: withProtected(_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(ProjectDetailPage, {}) })) },
            {
                path: routes.expenses,
                errorElement: _jsx(ExpensesErrorFallback, {}),
                element: withProtected(_jsx(ExpensesAccessRoute, { children: _jsx(ExpensesNestedLayout, {}) })),
                children: [
                    { index: true, element: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(ExpensesPage, {}) }) },
                    {
                        path: 'requests',
                        element: (_jsx(ExpensesMgmtRoute, { children: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(ExpensesRequestsPage, {}) }) })),
                    },
                    {
                        path: 'report',
                        element: (_jsx(ExpensesMgmtRoute, { children: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(ExpensesReportPage, {}) }) })),
                    },
                    {
                        path: 'clients',
                        element: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(ClientExpensesPage, {}) }),
                    },
                    {
                        path: 'partners',
                        element: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(PartnerExpensesPage, {}) }),
                    },
                    {
                        path: 'cash',
                        element: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(ExpensesCashPage, {}) }),
                    },
                    {
                        path: 'partners/report',
                        element: (_jsx(ExpensesMgmtRoute, { children: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(PartnerExpensesReportPage, {}) }) })),
                    },
                    { path: ':expenseId', element: _jsx(Suspense, { fallback: _jsx(LazyFallback, {}), children: _jsx(ExpensesPage, {}) }) },
                ],
            },
            { path: routes.todo, element: withProtected(_jsx(EnsureTodoI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(TodoPage, {}) })) },
            { path: routes.rules, element: withProtected(_jsx(RulesPage, {})) },
            { path: routes.help, element: withProtected(_jsx(HelpPage, {})) },
            { path: routes.kostaDaily, element: withProtected(_jsx(KostaDailyPage, {})) },
            { path: routes.contacts, element: withProtected(_jsx(AdminOnlyModuleRoute, { children: _jsx(EnsureContactsI18n, { fallback: _jsx(LazyFallback, {}), children: _jsx(ContactsPage, {}) }) })) },
            { path: routes.internalCommunication, element: withProtected(_jsx(InternalCommunicationPage, {})) },
            { path: routes.admin, element: withProtected(_jsx(AdminPage, {}), true) },
            { path: routes.networkDriveAccess, element: withProtected(_jsx(DesktopOnlyRoute, { children: _jsx(NetworkDriveAccessPage, {}) }), true) },
            { path: routes.userEdit, element: withProtected(_jsx(UserEditPage, {}), true) },
            { path: '*', element: _jsx(Navigate, { to: routes.home, replace: true }) },
        ],
    },
], (() => {
    const b = routerBasename();
    return b ? { basename: b } : {};
})());
export function AppRouter() {
    return _jsx(RouterProvider, { router: router });
}
export { router };
