import { combinedReportDetailLines, type CombinedReportLine, type CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';

/** Usable content height inside the A4 sheet, after page padding and the footer. */
const USABLE_PX = 700;
const THEAD_PX = 36;
const ROW_PX = 34;
const EXTRA_LINE_PX = 16;
const SECTION_HEAD_PX = 52;
const TOTAL_PX = 36;
const GAP_PX = 18;

export type CombinedReportPreviewSlice = {
    /** Project sheet. -1 is the merged report. */
    projectIndex: number;
    showMasthead: boolean;
    timeFrom: number;
    timeTo: number;
    showTimeTotal: boolean;
    peopleFrom: number;
    peopleTo: number;
    showPeopleTotal: boolean;
    expensesFrom: number;
    expensesTo: number;
    showExpensesTotal: boolean;
    sharesFrom: number;
    sharesTo: number;
    showSharesTotal: boolean;
};

function emptySlice(): CombinedReportPreviewSlice {
    return {
        projectIndex: -1,
        showMasthead: false,
        timeFrom: 0,
        timeTo: 0,
        showTimeTotal: false,
        peopleFrom: -1,
        peopleTo: -1,
        showPeopleTotal: false,
        expensesFrom: -1,
        expensesTo: -1,
        showExpensesTotal: false,
        sharesFrom: -1,
        sharesTo: -1,
        showSharesTotal: false,
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

function sortedProjectLines(report: CombinedReportSnapshot, projectIndex: number): CombinedReportLine[] {
    const lines = report.projects[projectIndex]?.lines ?? [];
    return [...lines].sort((a, b) => a.date.localeCompare(b.date)
        || (a.initials || a.user).localeCompare(b.initials || b.user));
}

function planPerProjectPages(report: CombinedReportSnapshot): CombinedReportPreviewSlice[] {
    const pages: CombinedReportPreviewSlice[] = [];
    report.projects.forEach((project, projectIndex) => {
        const lines = sortedProjectLines(report, projectIndex);
        const people = new Set(lines.map((line) => line.initials || line.user)).size;
        let page = { ...emptySlice(), projectIndex };
        let used = 0;
        const commit = () => {
            if (used <= 0)
                return;
            pages.push(page);
            page = { ...emptySlice(), projectIndex };
            used = 0;
        };
        const fits = (height: number) => used + height <= USABLE_PX;
        const title = project.pageTitle?.trim() || `${report.feeTitle} (${project.name})`;
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
        const peopleBlock = SECTION_HEAD_PX + people * (ROW_PX + EXTRA_LINE_PX) + TOTAL_PX;
        if (people > 0 && !fits(peopleBlock))
            commit();
        page.peopleFrom = 0;
        page.peopleTo = people;
        page.showPeopleTotal = people > 0;
        used += people > 0 ? peopleBlock : 0;
        commit();
    });
    return pages.length > 0 ? pages : [emptySlice()];
}

export function planCombinedReportPreviewPages(report: CombinedReportSnapshot): CombinedReportPreviewSlice[] {
    if (report.layout === 'perProject')
        return planPerProjectPages(report);
    const lines = combinedReportDetailLines(report);
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

    packRows({
        count: report.people.length,
        rowHeight: (index) => rowPx(textLines(report.people[index]?.name || '', 22)),
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
