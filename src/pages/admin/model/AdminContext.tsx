import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { KNOWN_ROLES, ROLE_META, TT_ROLE_OPTIONS, TT_POSITIONS, TT_POSITION_META } from './constants';
import type { AdminContextValue } from './AdminContext.types';
import { useAdminUsers } from './hooks/useAdminUsers';
import { useAdminDropdowns } from './hooks/useAdminDropdowns';
import { useAdminTickets } from './hooks/useAdminTickets';
import { useAdminAttendance } from './hooks/useAdminAttendance';
const AdminContext = createContext<AdminContextValue | null>(null);
export function useAdmin() {
    const ctx = useContext(AdminContext);
    if (!ctx)
        throw new Error('useAdmin must be used within AdminProvider');
    return ctx;
}
type AdminProviderProps = {
    children: ReactNode;
};
export function AdminProvider({ children }: AdminProviderProps) {
    const dropdowns = useAdminDropdowns();
    const { closePosDropdown, ...dropdownsValue } = dropdowns;
    const users = useAdminUsers(closePosDropdown);
    const tickets = useAdminTickets();
    const attendance = useAdminAttendance();
    const value: AdminContextValue = useMemo(() => ({
        ...users,
        ...dropdownsValue,
        ...tickets,
        ...attendance,
        KNOWN_ROLES,
        ROLE_META,
        TT_ROLE_OPTIONS,
        TT_POSITIONS,
        TT_POSITION_META,
    }), [users, dropdownsValue, tickets, attendance]);
    return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
