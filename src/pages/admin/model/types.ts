export type LateRow = {
    name: string;
    department: string;
    firstTime: string;
    minutesLate: number;
    personId?: string;
    explanationText?: string | null;
    explanationFileUrl?: string | null;
};
export type AdminMetrics = {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    archivedUsers: number;
    roles: {
        name: string;
        count: number;
    }[];
};
export type LateMetrics = {
    total: number;
    lateCount: number;
    onTime: number;
    lateEmployees: LateRow[];
};
