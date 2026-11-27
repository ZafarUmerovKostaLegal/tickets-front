import {
    combinedPeopleRows,
    combinedReportDetailLines,
    combinedReportFlatLines,
    flatFeeLines,
    hourlyLines,
    isFlatFeeLine,
    projectExpenseIndexes,
    projectSummaryRows,
    type CombinedReportLine,
    type CombinedReportSnapshot,
} from '@pages/time-tracking/lib/combinedInvoice';

const USABLE_PX = 820;
const THEAD_PX = 36;
const ROW_PX = 34;
const EXTRA_LINE_PX = 16;
const SECTION_HEAD_PX = 52;
const TOTAL_PX = 36;
const GAP_PX = 18;
export const LETTERHEAD_PX = 96;

export type CombinedReportPreviewSlice = {
    projectIndex: number;
    showMasthead: boolean;
    timeFrom: number;
    timeTo: number;
    showTimeTotal: boolean;
    flatFrom: number;
    flatTo: number;
    showFlatTotal: boolean;
    showLetterhead: boolean;
    peopleFrom: number;
    peopleTo: number;
    showPeopleTotal: boolean;
    expensesFrom: number;
    expensesTo: number;
    showExpensesTotal: boolean;
    sharesFrom: number;
    sharesTo: number;
    showSharesTotal: boolean;
    showProjectsSummary: boolean;
};

export type CombinedProjectTotal = { name: string; hours: number; fees: number; expenses: number; total: number };

export function combinedProjectTotals(report: CombinedReportSnapshot): { rows: CombinedProjectTotal[]; total: CombinedProjectTotal } {
    const rows = report.projects.map((project, projectIndex) => {
        const hours = project.lines.reduce((sum, line) => sum + (isFlatFeeLine(line) ? 0 : Number(line.hours) || 0), 0);
        const fees = project.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
        const expenses = projectExpenseIndexes(report, projectIndex)
            .reduce((sum, index) => sum + (Number(report.expenses[index]?.amount) || 0), 0);
        return { name: project.name, hours, fees, expenses, total: fees + expenses };
    });
    const total = rows.reduce((sum, row) => ({
        name: '',
        hours: sum.hours + row.hours,
        fees: sum.fees + row.fees,
        expenses: sum.expenses + row.expenses,
        total: sum.total + row.total,
    }), { name: '', hours: 0, fees: 0, expenses: 0, total: 0 });
    return { rows, total };
}

export function hasProjectsSummary(report: CombinedReportSnapshot): boolean {
    return report.layout === 'perProject' && report.projects.length > 1;
}

function emptySlice(): CombinedReportPreviewSlice {
    return {
        projectIndex: -1,
        showMasthead: false,
        timeFrom: 0,
        timeTo: 0,
        showTimeTotal: false,
        flatFrom: -1,
        flatTo: -1,
        showFlatTotal: false,
        showLetterhead: false,
        peopleFrom: -1,
        peopleTo: -1,
        showPeopleTotal: false,
        expensesFrom: -1,
        expensesTo: -1,
        showExpensesTotal: false,
        sharesFrom: -1,
        sharesTo: -1,
        showSharesTotal: false,
        showProjectsSummary: false,
    };
}

function textLines(text: string, charsPerLine: number): number {
    const parts = text.split(/\r?\n/);
    let count = 0;
    for (const part of parts) {
        const len = part.trim().length;
        count += len === 0 ? 1 : Math.ceil(len / charsPerLine);
    }
    return Math.max(1, count);
}

function rowPx(lines: number): number {
    return ROW_PX + Math.max(0, lines - 1) * EXTRA_LINE_PX;
}

function mastheadPx(title: string): number {
    const lines = textLines(title.toUpperCase(), 88);
    return 78 + lines * 14 + 8;
}

function timeRowPx(line: CombinedReportLine): number {
    return rowPx(Math.max(
        textLines(line.task || '', 16),
        textLines(line.description || '', 36),
    ));
}

export function sortedProjectLines(report: CombinedReportSnapshot, projectIndex: number): CombinedReportLine[] {
    return hourlyLines(report.projects[projectIndex]?.lines ?? []);
}

export function sortedProjectFlatLines(report: CombinedReportSnapshot, projectIndex: number): CombinedReportLine[] {
    return flatFeeLines(report.projects[projectIndex]?.lines ?? []);
}

function flatRowPx(line: CombinedReportLine): number {
    return timeRowPx(line);
}

function planPerProjectPages(report: CombinedReportSnapshot): CombinedReportPreviewSlice[] {
    const pages: CombinedReportPreviewSlice[] = [];
    let lastUsed = 0;
    report.projects.forEach((project, projectIndex) => {
        const lines = sortedProjectLines(report, projectIndex);
        const flat = sortedProjectFlatLines(report, projectIndex);
        const people = projectSummaryRows(report, projectIndex).length;
        let page = { ...emptySlice(), projectIndex };
        let used = 0;
        const commit = () => {
            if (used <= 0)
                return;
            pages.push(page);
            lastUsed = used;
            page = { ...emptySlice(), projectIndex };
            used = 0;
        };
        const fits = (height: number) => used + height <= USABLE_PX;
        const title = project.pageTitle?.trim() || `${report.feeTitle} (${project.name})`;
        if (projectIndex === 0) {
            page.showLetterhead = true;
            used += LETTERHEAD_PX;
        }
        page.showMasthead = true;
        used += mastheadPx(title);
        if (!fits(THEAD_PX))
            commit();
        used += THEAD_PX;
        page.timeFrom = 0;
        lines.forEach((line, index) => {
            const height = timeRowPx(line);
            if (!fits(height)) {
                page.timeTo = index;
                commit();
                page.timeFrom = index;
                used += THEAD_PX;
            }
            page.timeTo = index + 1;
            used += height;
        });
        if (!fits(TOTAL_PX)) {
            commit();
            page.timeFrom = lines.length;
            page.timeTo = lines.length;
            used += THEAD_PX;
        }
        page.showTimeTotal = true;
        used += TOTAL_PX + GAP_PX;
        if (flat.length > 0) {
            let opened = false;
            const openFlat = (index: number) => {
                if (!fits(SECTION_HEAD_PX + THEAD_PX))
                    commit();
                page.flatFrom = index;
                page.flatTo = index;
                used += SECTION_HEAD_PX + THEAD_PX;
                opened = true;
            };
            flat.forEach((line, index) => {
                const height = flatRowPx(line);
                if (!fits((opened ? 0 : SECTION_HEAD_PX + THEAD_PX) + height)) {
                    commit();
                    opened = false;
                }
                if (!opened)
                    openFlat(index);
                page.flatTo = index + 1;
                used += height;
            });
            if (!fits(TOTAL_PX)) {
                commit();
                opened = false;
            }
            if (!opened)
                openFlat(flat.length);
            page.showFlatTotal = true;
            used += TOTAL_PX + GAP_PX;
        }
        const peopleBlock = SECTION_HEAD_PX + people * ROW_PX + TOTAL_PX;
        if (people > 0 && !fits(peopleBlock))
            commit();
        page.peopleFrom = 0;
        page.peopleTo = people;
        page.showPeopleTotal = people > 0;
        used += people > 0 ? peopleBlock : 0;
        const expenseIndexes = projectExpenseIndexes(report, projectIndex);
        if (expenseIndexes.length > 0) {
            let opened = false;
            const expenseHeight = (localIndex: number) => {
                const line = report.expenses[expenseIndexes[localIndex]!];
                return rowPx(textLines(line?.description || '', 64));
            };
            const openExpenses = (localIndex: number) => {
                if (!fits(SECTION_HEAD_PX))
                    commit();
                page.expensesFrom = localIndex;
                page.expensesTo = localIndex;
                used += SECTION_HEAD_PX;
                opened = true;
            };
            for (let index = 0; index < expenseIndexes.length; index += 1) {
                const height = expenseHeight(index);
                if (!fits((opened ? 0 : SECTION_HEAD_PX) + height)) {
                    commit();
                    opened = false;
                }
                if (!opened)
                    openExpenses(index);
                page.expensesTo = index + 1;
                used += height;
            }
            if (!fits((opened ? 0 : SECTION_HEAD_PX) + TOTAL_PX)) {
                commit();
                opened = false;
            }
            if (!opened)
                openExpenses(expenseIndexes.length);
            page.showExpensesTotal = true;
            used += TOTAL_PX + GAP_PX;
        }
        commit();
    });
    if (hasProjectsSummary(report) && pages.length > 0) {
        const height = GAP_PX + SECTION_HEAD_PX + THEAD_PX + report.projects.length * ROW_PX + TOTAL_PX;
        const last = pages[pages.length - 1]!;
        if (lastUsed + height <= USABLE_PX)
            last.showProjectsSummary = true;
        else {
            const lines = sortedProjectLines(report, last.projectIndex).length;
            pages.push({ ...emptySlice(), projectIndex: last.projectIndex, timeFrom: lines, timeTo: lines, showProjectsSummary: true });
        }
    }
    return pages.length > 0 ? pages : [emptySlice()];
}

export function planCombinedReportPreviewPages(report: CombinedReportSnapshot): CombinedReportPreviewSlice[] {
    if (report.layout === 'perProject')
        return planPerProjectPages(report);
    const lines = combinedReportDetailLines(report);
    const flat = combinedReportFlatLines(report);
    const people = combinedPeopleRows(report);
    const pages: CombinedReportPreviewSlice[] = [];
    let page = emptySlice();
    let used = 0;

    const commit = () => {
        if (used <= 0)
            return;
        pages.push(page);
        page = emptySlice();
        used = 0;
    };
    const fits = (height: number) => used + height <= USABLE_PX;
    const add = (height: number) => {
        used += height;
    };

    page.showMasthead = true;
    add(mastheadPx(report.feeTitle));

    if (!fits(THEAD_PX))
        commit();
    add(THEAD_PX);
    page.timeFrom = 0;
    lines.forEach((line, index) => {
        const height = timeRowPx(line);
        if (!fits(height)) {
            page.timeTo = index;
            commit();
            page.timeFrom = index;
            add(THEAD_PX);
        }
        page.timeTo = index + 1;
        add(height);
    });
    if (!fits(TOTAL_PX)) {
        commit();
        page.timeFrom = lines.length;
        page.timeTo = lines.length;
        add(THEAD_PX);
    }
    page.showTimeTotal = true;
    add(TOTAL_PX + GAP_PX);

    if (flat.length > 0) {
        packRows({
            count: flat.length,
            rowHeight: (index) => flatRowPx(flat[index]!),
            begin: (index) => {
                page.flatFrom = index;
                page.flatTo = index;
            },
            take: (index) => {
                page.flatTo = index + 1;
            },
            finish: () => {
                page.showFlatTotal = true;
            },
        });
    }
    packRows({
        count: people.length,
        rowHeight: (index) => rowPx(textLines(people[index]?.name || '', 22)),
        begin: (index) => {
            page.peopleFrom = index;
            page.peopleTo = index;
        },
        take: (index) => {
            page.peopleTo = index + 1;
        },
        finish: () => {
            page.showPeopleTotal = true;
        },
    });
    packRows({
        count: report.expenses.length,
        rowHeight: (index) => rowPx(textLines(report.expenses[index]?.description || '', 64)),
        begin: (index) => {
            page.expensesFrom = index;
            page.expensesTo = index;
        },
        take: (index) => {
            page.expensesTo = index + 1;
        },
        finish: () => {
            page.showExpensesTotal = true;
        },
    });
    packRows({
        count: report.shares.length,
        rowHeight: () => ROW_PX,
        begin: (index) => {
            page.sharesFrom = index;
            page.sharesTo = index;
        },
        take: (index) => {
            page.sharesTo = index + 1;
        },
        finish: () => {
            page.showSharesTotal = true;
        },
    });

    commit();
    return pages.length > 0 ? pages : [emptySlice()];

    function packRows(args: {
        count: number;
        rowHeight: (index: number) => number;
        begin: (index: number) => void;
        take: (index: number) => void;
        finish: () => void;
    }) {
        let opened = false;
        const open = (index: number) => {
            if (!fits(SECTION_HEAD_PX))
                commit();
            args.begin(index);
            add(SECTION_HEAD_PX);
            opened = true;
        };
        for (let index = 0; index < args.count; index += 1) {
            const height = args.rowHeight(index);
            if (!fits((opened ? 0 : SECTION_HEAD_PX) + height)) {
                commit();
                opened = false;
            }
            if (!opened)
                open(index);
            args.take(index);
            add(height);
        }
        if (!fits((opened ? 0 : SECTION_HEAD_PX) + TOTAL_PX)) {
            commit();
            opened = false;
        }
        if (!opened)
            open(args.count);
        args.finish();
        add(TOTAL_PX + GAP_PX);
    }
}
