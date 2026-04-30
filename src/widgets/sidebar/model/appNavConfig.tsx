import type { ComponentType } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { routes } from '@shared/config';
import type { User } from '@entities/user';
import { canAccessExpensesSection } from '@entities/expenses/model/expenseModeration';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { canAccessAdminPanel, isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';
import { IconHome, IconTicket, IconGear, IconClock, IconBox, IconStopwatch, IconList, IconWallet, IconFileText, IconHelpCircle, IconCalendarCheck, IconPhone, IconFolderNetwork, } from '../ui/SidebarIcons';

export type AppNavItemDef = {
    to: string;
    label: string;
    icon: ComponentType;
    adminOnly?: boolean;
    /** Только роль «Администратор» (например сетевой диск), без партнёров. */
    adminOnlyStrict?: boolean;
    desktopOnly?: boolean;
};

export const APP_NAV_DEFINITIONS: AppNavItemDef[] = [
    { to: routes.home, label: 'Главная', icon: IconHome },
    { to: routes.timeTracking, label: 'Учёт времени', icon: IconStopwatch },
    { to: routes.expenses, label: 'Расходы', icon: IconWallet },
    { to: routes.todo, label: 'Список дел', icon: IconList },
    { to: routes.tickets, label: 'Заявки', icon: IconTicket },
    { to: routes.vacationSchedule, label: 'График отпусков', icon: IconCalendarCheck },
    { to: routes.inventory, label: 'Инвентаризация', icon: IconBox },
    { to: routes.admin, label: 'Админ-панель', icon: IconGear },
    { to: routes.networkDriveAccess, label: 'Сетевой диск', icon: IconFolderNetwork, adminOnly: true, adminOnlyStrict: true, desktopOnly: true },
    { to: routes.attendance, label: 'Посещаемость', icon: IconClock },
    { to: routes.callSchedule, label: 'Расписание звонков', icon: IconPhone },
    { to: routes.rules, label: 'Правила', icon: IconFileText },
    { to: routes.help, label: 'Помощь', icon: IconHelpCircle },
];

export function getVisibleAppNavItems(user: User | null | undefined, loading: boolean): AppNavItemDef[] {
    const role = user?.role?.toLowerCase() || '';
    const isEmployee = !loading && role.includes('сотрудник');
    const rk = normalizeOrgRoleKey(user?.role);
    const isAdminOrPartner = !loading && (rk.includes('администратор') || isPartnerOrgRole(user?.role, user?.position));
    let visible: AppNavItemDef[] = APP_NAV_DEFINITIONS;
    if (isEmployee) {
        visible = APP_NAV_DEFINITIONS.filter((item) => item.label === 'Главная' ||
            item.label === 'Учёт времени' ||
            item.label === 'Расходы' ||
            item.label === 'Список дел' ||
            item.label === 'Заявки' ||
            item.label === 'График отпусков' ||
            item.label === 'Посещаемость' ||
            item.label === 'Правила' ||
            item.label === 'Помощь');
    }
    else if (!isAdminOrPartner) {
        visible = visible.filter((item) => item.label !== 'Админ-панель');
    }
    if (!loading && !canAccessExpensesSection(user?.role)) {
        visible = visible.filter((item) => item.label !== 'Расходы');
    }
    if (!loading && !canAccessTimeTracking(user)) {
        visible = visible.filter((item) => item.label !== 'Учёт времени');
    }
    if (!loading) {
        visible = visible.filter((item) => {
            if (!item.adminOnly)
                return true;
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
