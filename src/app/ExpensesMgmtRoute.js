import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import {} from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canViewExpensesRequestsAndReport } from '@entities/expenses/model/expenseModeration';
export function ExpensesMgmtRoute({ children }) {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return null;
    }
    if (!canViewExpensesRequestsAndReport(user?.role)) {
        return _jsx(Navigate, { to: routes.expenses, replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
