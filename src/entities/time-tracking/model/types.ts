export type TimeTabId = 'users' | 'projects' | 'expenses' | 'timesheet' | 'reports' | 'invoices' | 'settings' | 'clients';
export type ProjectType = 'Время и материалы' | 'Фиксированная ставка' | 'Без бюджета';
export type ProjectStatus = 'active' | 'paused' | 'archived';
export type ProjectRow = {
    id: string;
    name: string;
    client: string;
    clientId: string;
    type: ProjectType;
    budget?: number;
    spent: number;
    costs: number;
    currency: string;
    status: ProjectStatus;
    managers?: string[];
    budgetIncludesExpenses?: boolean;
    deletable?: boolean;
};
export type ExpenseCategory = 'Транспорт' | 'Питание' | 'Командировка' | 'Офис' | 'ПО и сервисы' | 'Представительские' | 'Прочее';
export type ExpenseStatus = 'approved' | 'pending' | 'rejected';
export type ExpenseRow = {
    id: string;
    date: string;
    employee: string;
    initials: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    currency: string;
    status: ExpenseStatus;
    project?: string;
    client?: string;
    billable?: boolean;
};
export type TimeUserRow = {
    id: string;
    name: string;
    initials: string;
    avatarUrl?: string;
    isOnline?: boolean;
    
    position?: string;
    hours: number;
    billableHours: number;
    utilizationPercent: number;
    capacity: number;
};
export type TimeUsersTotals = {
    totalHours: number;
    teamCapacity: number;
    billableHours: number;
    nonBillableHours: number;
    teamWorkloadPercent: number;
};
