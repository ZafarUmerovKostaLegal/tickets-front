import { type ReactNode, lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { routes } from '@shared/config';
import { ProtectedRoute } from '@app/ProtectedRoute';
import { GuestOnlyRoute } from '@app/GuestOnlyRoute';
import { PageTransition } from '@app/PageTransition';
import { TimeTrackingRoute } from '@app/TimeTrackingRoute';
import { ReportPreviewRoute } from '@app/ReportPreviewRoute';
import { ExpensesAccessRoute } from '@app/ExpensesAccessRoute';
import { ExpensesMgmtRoute } from '@app/ExpensesMgmtRoute';
import { ExpensesNestedLayout } from '@app/ExpensesNestedLayout';
import { ExpensesErrorFallback } from '@pages/expenses/ui/ExpensesErrorFallback';
import { AppRouteError } from '@app/ui/AppRouteError';
import { DesktopOnlyRoute } from '@app/DesktopOnlyRoute';


function routerBasename(): string | undefined {
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
const InventoryPage = lazy(() => import('@pages/inventory').then(m => ({ default: m.InventoryPage })));
const ProjectDetailPage = lazy(() => import('@pages/project-detail').then(m => ({ default: m.ProjectDetailPage })));
const TimeTrackingNewProjectPage = lazy(() => import('@pages/time-tracking/ui/TimeTrackingNewProjectPage').then(m => ({ default: m.TimeTrackingNewProjectPage })));
const TicketDetailPage = lazy(() => import('@pages/ticket-detail').then(m => ({ default: m.TicketDetailPage })));
const UserEditPage = lazy(() => import('@pages/user-edit').then(m => ({ default: m.UserEditPage })));
const TodoPage = lazy(() => import('@pages/todo').then(m => ({ default: m.TodoPage })));
const RulesPage = lazy(() => import('@pages/rules').then(m => ({ default: m.RulesPage })));
const HelpPage = lazy(() => import('@pages/help').then(m => ({ default: m.HelpPage })));
const ExpensesPage = lazy(() => import('@pages/expenses').then(m => ({ default: m.ExpensesPage })));
const ExpensesRequestsPage = lazy(() => import('@pages/expenses').then(m => ({ default: m.ExpensesRequestsPage })));
const ExpensesReportPage = lazy(() => import('@pages/expenses').then(m => ({ default: m.ExpensesReportPage })));
const InvoicePreviewRouteLazy = lazy(() => import('@app/InvoicePreviewRoute').then(m => ({ default: m.InvoicePreviewRoute })));

function LazyFallback() {
    return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', minHeight: '60vh' }}>
      <div className="app-splash__progress-wrap" style={{ opacity: 0.5 }}>
        <svg className="app-splash__progress-ring" viewBox="0 0 36 36" width={36} height={36}>
          <circle className="app-splash__progress-bg" cx="18" cy="18" r="15.9"/>
          <circle className="app-splash__progress-fill" cx="18" cy="18" r="15.9" strokeDasharray="30 100" transform="rotate(-90 18 18)"/>
        </svg>
      </div>
    </div>);
}
function withGuest(children: ReactNode) {
    return (<GuestOnlyRoute>
      <PageTransition>
        <Suspense fallback={<LazyFallback />}>{children}</Suspense>
      </PageTransition>
    </GuestOnlyRoute>);
}
function withProtected(children: ReactNode, adminOnly = false) {
    return (<ProtectedRoute adminOnly={adminOnly}>
      <PageTransition>
        <Suspense fallback={<LazyFallback />}>{children}</Suspense>
      </PageTransition>
    </ProtectedRoute>);
}
const router = createBrowserRouter([
    {
        element: <Outlet />,
        errorElement: <AppRouteError />,
        children: [
            { path: routes.login, element: withGuest(<LoginPage />) },
            { path: routes.authCallback, element: <Suspense fallback={<LazyFallback />}><AuthCallbackPage /></Suspense> },
            { path: routes.home, element: withProtected(<HomePage />) },
            { path: routes.tickets, element: withProtected(<TicketsPage />) },
            { path: routes.ticketDetail, element: withProtected(<TicketDetailPage />) },
            { path: routes.attendance, element: withProtected(<AttendancePage />) },
            { path: routes.vacationSchedule, element: withProtected(<VacationSchedulePage />) },
            { path: routes.callSchedule, element: withProtected(<CallSchedulePage />) },
            { path: routes.inventory, element: withProtected(<InventoryPage />) },
            { path: routes.timeTracking, element: withProtected(<TimeTrackingRoute />) },
            { path: routes.timeTrackingNewProject, element: withProtected(<TimeTrackingNewProjectPage />) },
            { path: routes.timeTrackingReportPreview, element: withProtected(<ReportPreviewRoute />) },
            { path: routes.timeTrackingInvoicePreview, element: withProtected(<InvoicePreviewRouteLazy />) },
            { path: routes.projectDetail, element: withProtected(<ProjectDetailPage />) },
            {
                path: routes.expenses,
                errorElement: <ExpensesErrorFallback />,
                element: withProtected(<ExpensesAccessRoute>
            <ExpensesNestedLayout />
          </ExpensesAccessRoute>),
                children: [
                    { index: true, element: <Suspense fallback={<LazyFallback />}><ExpensesPage /></Suspense> },
                    {
                        path: 'requests',
                        element: (<ExpensesMgmtRoute>
                <Suspense fallback={<LazyFallback />}><ExpensesRequestsPage /></Suspense>
              </ExpensesMgmtRoute>),
                    },
                    {
                        path: 'report',
                        element: (<ExpensesMgmtRoute>
                <Suspense fallback={<LazyFallback />}><ExpensesReportPage /></Suspense>
              </ExpensesMgmtRoute>),
                    },
                    { path: ':expenseId', element: <Suspense fallback={<LazyFallback />}><ExpensesPage /></Suspense> },
                ],
            },
            { path: routes.todo, element: withProtected(<TodoPage />) },
            { path: routes.rules, element: withProtected(<RulesPage />) },
            { path: routes.help, element: withProtected(<HelpPage />) },
            { path: routes.admin, element: withProtected(<AdminPage />, true) },
            { path: routes.networkDriveAccess, element: withProtected(<DesktopOnlyRoute>
              <NetworkDriveAccessPage />
            </DesktopOnlyRoute>, true) },
            { path: routes.userEdit, element: withProtected(<UserEditPage />, true) },
            { path: '*', element: <Navigate to={routes.home} replace/> },
        ],
    },
], (() => {
    const b = routerBasename();
    return b ? { basename: b } : {};
})());
export function AppRouter() {
    return <RouterProvider router={router}/>;
}
