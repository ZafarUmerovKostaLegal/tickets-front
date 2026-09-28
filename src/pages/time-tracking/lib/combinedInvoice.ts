import type { TimeManagerClientProjectRow, UnbilledExpenseEntryDto, UnbilledTimeEntryDto } from '@entities/time-tracking';

export type CombinedAllocation = 'hours' | 'equal';

export type CombinedInvoiceTemplate = {
    id: string;
    name: string;
    payerClientId: string;
    projectIds: string[];
    allocation: CombinedAllocation;
    feeTitle: string;
};

export type CombinedTimeLine = UnbilledTimeEntryDto & { projectId: string };
export type CombinedExpenseLine = UnbilledExpenseEntryDto & { projectId: string };

export type CombinedShare = {
    projectId: string;
    projectName: string;
    clientName: string;
    percent: number;
    fees: number;
    expenses: number;
    total: number;
};

const STORAGE_KEY = 'kl-combined-invoice-templates-v1';

export function loadCombinedInvoiceTemplates(): CombinedInvoiceTemplate[] {
    if (typeof localStorage === 'undefined')
        return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw) as CombinedInvoiceTemplate[];
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
    }
    catch {
        return [];
    }
}

export function saveCombinedInvoiceTemplates(items: CombinedInvoiceTemplate[]): void {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function buildCombinedShares(
    projects: TimeManagerClientProjectRow[],
    clientNameById: ReadonlyMap<string, string>,
    time: CombinedTimeLine[],
    expenses: CombinedExpenseLine[],
    allocation: CombinedAllocation,
): CombinedShare[] {
    const fees = new Map<string, number>();
    const exp = new Map<string, number>();
    for (const line of time)
        fees.set(line.projectId, (fees.get(line.projectId) ?? 0) + line.billableAmount);
    for (const line of expenses)
        exp.set(line.projectId, (exp.get(line.projectId) ?? 0) + line.equivalentAmount);
    const totalFees = [...fees.values()].reduce((sum, value) => sum + value, 0);
    const totalExp = [...exp.values()].reduce((sum, value) => sum + value, 0);
    const count = Math.max(projects.length, 1);
    return projects.map((project) => {
        const ownFees = fees.get(project.id) ?? 0;
        const ownExp = exp.get(project.id) ?? 0;
        const percent = allocation === 'equal'
            ? 100 / count
            : (totalFees > 0 ? (ownFees / totalFees) * 100 : 100 / count);
        const shareFees = allocation === 'equal' ? totalFees / count : ownFees;
        const shareExp = allocation === 'equal' ? totalExp / count : ownExp;
        return {
            projectId: project.id,
            projectName: project.name,
            clientName: clientNameById.get(project.client_id) ?? '',
            percent,
            fees: shareFees,
            expenses: shareExp,
            total: shareFees + shareExp,
        };
    });
}

export function formatCombinedShareNote(shares: CombinedShare[]): string {
    const lines = [
        'Shared amounts',
        ...shares.map((share) => {
            const client = share.clientName ? ` (${share.clientName})` : '';
            return `${share.projectName}${client}: ${share.percent.toFixed(2)}% · fees ${share.fees.toFixed(2)} · expenses ${share.expenses.toFixed(2)} · TO BE INVOICED ${share.total.toFixed(2)}`;
        }),
    ];
    return lines.join('\n');
}
