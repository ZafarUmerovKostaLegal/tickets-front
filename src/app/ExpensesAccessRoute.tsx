import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessExpensesSection } from '@entities/expenses/model/expenseModeration';
type ExpensesAccessRouteProps = {
    children: ReactNode;
};
export function ExpensesAccessRoute({ children }: ExpensesAccessRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return null;
    }
    if (!canAccessExpensesSection(user?.role)) {
        return <Navigate to={routes.home} replace/>;
    }
    return <>{children}</>;
}
