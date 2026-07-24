import type { ComponentType } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { routes } from '@shared/config';
import type { User } from '@entities/user';
import { canAccessExpensesSection } from '@entities/expenses/model/expenseModeration';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { canAccessAdminPanel, canAccessAdminOnlyModules, canAccessAttendance, isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';
import type { TranslationKey } from '@shared/i18n/translate';
import { IconHome, IconTicket, IconGear, IconClock, IconBox, IconStopwatch, IconList, IconWallet, IconFileText, IconHelpCircle, IconCalendarCheck, IconPhone, IconFolderNetwork, IconMailInbox, IconMessages, IconContacts, IconAccounting, } from '../ui/SidebarIcons';

export type AppNavId =
    | 'home'
    | 'timeTracking'
    | 'expenses'
    | 'todo'
    | 'tickets'
    | 'correspondence'
    | 'accounting'
    | 'kostaDaily'
    | 'vacationSchedule'
    | 'inventory'
    | 'admin'
    | 'networkDrive'
    | 'attendance'
    | 'callSchedule'
    | 'rules'
    | 'help'
    | 'contacts'
    | 'internalCommunication';

export type AppNavItemDef = {
    id: AppNavId;
    to: string;
    icon: ComponentType;
    adminOnly?: boolean;

    adminOnlyStrict?: boolean;

    adminModulesOnly?: boolean;
    desktopOnly?: boolean;
};

const EMPLOYEE_NAV_IDS = new Set<AppNavId>([
    'home',
    'timeTracking',
    'expenses',
    'todo',
    'tickets',
    'correspondence',
    'kostaDaily',
    'vacationSchedule',
    'rules',
    'help',
    'internalCommunication',
]);

export const APP_NAV_DEFINITIONS: AppNavItemDef[] = [
    { id: 'home', to: routes.home, icon: IconHome },
    { id: 'timeTracking', to: routes.timeTracking, icon: IconStopwatch },
    { id: 'expenses', to: routes.expenses, icon: IconWallet },
    { id: 'todo', to: routes.todo, icon: IconList },
    { id: 'tickets', to: routes.tickets, icon: IconTicket },
    { id: 'correspondence', to: routes.correspondence, icon: IconMailInbox },
    { id: 'accounting', to: routes.accounting, icon: IconAccounting, adminOnly: true, adminModulesOnly: true },
    { id: 'kostaDaily', to: routes.kostaDaily, icon: IconMessages },
    { id: 'vacationSchedule', to: routes.vacationSchedule, icon: IconCalendarCheck },
    { id: 'inventory', to: routes.inventory, icon: IconBox },
    { id: 'admin', to: routes.admin, icon: IconGear },
    { id: 'networkDrive', to: routes.networkDriveAccess, icon: IconFolderNetwork, adminOnly: true, adminOnlyStrict: true, desktopOnly: true },
    { id: 'attendance', to: routes.attendance, icon: IconClock },
    { id: 'callSchedule', to: routes.callSchedule, icon: IconPhone },
    { id: 'rules', to: routes.rules, icon: IconFileText },
    { id: 'contacts', to: routes.contacts, icon: IconContacts, adminOnly: true, adminModulesOnly: true },
    { id: 'internalCommunication', to: routes.internalCommunication, icon: IconPhone },
    { id: 'help', to: routes.help, icon: IconHelpCircle },
];

export function getNavTranslationKey(id: AppNavId): TranslationKey {
    return `nav.${id}` as TranslationKey;
}

export function getVisibleAppNavItems(user: User | null | undefined, loading: boolean): AppNavItemDef[] {
    const role = user?.role?.toLowerCase() || '';
    const isEmployee = !loading && role.includes('сотрудник');
    const rk = normalizeOrgRoleKey(user?.role);
    const isAdminOrPartner = !loading && (rk.includes('администратор') || isPartnerOrgRole(user?.role, user?.position));
    let visible: AppNavItemDef[] = APP_NAV_DEFINITIONS;
    if (isEmployee) {
        visible = APP_NAV_DEFINITIONS.filter((item) => EMPLOYEE_NAV_IDS.has(item.id));
    }
    else if (!isAdminOrPartner) {
        visible = visible.filter((item) => item.id !== 'admin');
    }
    if (!loading && !canAccessExpensesSection(user?.role)) {
        visible = visible.filter((item) => item.id !== 'expenses');
    }
    if (!loading && !canAccessTimeTracking(user)) {
        visible = visible.filter((item) => item.id !== 'timeTracking');
    }
    if (!loading && !canAccessAttendance(user?.role, user?.position)) {
        visible = visible.filter((item) => item.id !== 'attendance');
    }
    if (!loading) {
        visible = visible.filter((item) => {
            if (!item.adminOnly)
                return true;
            if (item.adminModulesOnly)
                return canAccessAdminOnlyModules(user?.role);
            if (item.adminOnlyStrict)
                return user?.role === 'Администратор';
            return canAccessAdminPanel(user?.role, user?.position);
        });
    }
    if (!loading && !isTauri()) {
        visible = visible.filter((item) => !item.desktopOnly);
    }
    return visible;
}
