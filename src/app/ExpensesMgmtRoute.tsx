import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canViewExpensesRequestsAndReport } from '@entities/expenses/model/expenseModeration';
type ExpensesMgmtRouteProps = {
    children: ReactNode;
};
export function ExpensesMgmtRoute({ children }: ExpensesMgmtRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return null;
    }
    if (!canViewExpensesRequestsAndReport(user?.role)) {
        return <Navigate to={routes.expenses} replace/>;
    }
    return <>{children}</>;
}
