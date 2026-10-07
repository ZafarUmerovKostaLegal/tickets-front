import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo } from 'react';
import { KNOWN_ROLES, ROLE_META, TT_ROLE_OPTIONS } from './constants';
import { useAdminUsers } from './hooks/useAdminUsers';
import { useAdminDropdowns } from './hooks/useAdminDropdowns';
import { useAdminTickets } from './hooks/useAdminTickets';
import { useAdminAttendance } from './hooks/useAdminAttendance';
const AdminContext = createContext(null);
export function useAdmin() {
    const ctx = useContext(AdminContext);
    if (!ctx)
        throw new Error('useAdmin must be used within AdminProvider');
    return ctx;
}
export function AdminProvider({ children }) {
    const dropdowns = useAdminDropdowns();
    const { closePosDropdown, ...dropdownsValue } = dropdowns;
    const users = useAdminUsers(closePosDropdown);
    const tickets = useAdminTickets();
    const attendance = useAdminAttendance();
    const value = useMemo(() => ({
        ...users,
        ...dropdownsValue,
        ...tickets,
        ...attendance,
        KNOWN_ROLES,
        ROLE_META,
        TT_ROLE_OPTIONS,
        TT_POSITIONS: users.positions,
    }), [users, dropdownsValue, tickets, attendance]);
    return _jsx(AdminContext.Provider, { value: value, children: children });
}
