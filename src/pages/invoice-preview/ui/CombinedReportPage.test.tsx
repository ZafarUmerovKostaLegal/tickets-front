import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CombinedReportLine, CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import { planCombinedReportPreviewPages } from '../lib/combinedReportPreviewPages';
import { CombinedReportPage } from './CombinedReportPage';

const ADA = { user: 'Alina Abdullaeva', initials: 'ADA' };
const lines: CombinedReportLine[] = [
    { ...ADA, date: '2026-10-23', task: 'Drafting', description: 'Employment contract', hours: 8, rate: 1_500_000, amount: 12_000_000 },
    { ...ADA, date: '2026-09-08', task: 'My mehnat registration', description: 'Vacancy removed from mymehnat.uz', hours: 0.4, rate: 575_000, amount: 230_000 },
];

function report(layout: 'perProject' | 'merged'): CombinedReportSnapshot {
    return {
        feeTitle: 'Fees for services in September and October 2026',
        currency: 'UZS',
        layout,
        projects: [{ name: 'General legal services', lines }],
        people: [{ initials: 'ADA', name: 'Alina Abdullaeva', title: 'Junior Associate', hours: 8.4, rate: 1_455_952.38, amount: 12_230_000 }],
        expenses: [],
        shares: [],
        totalHours: 8.4,
        totalFees: 12_230_000,
        totalExpenses: 0,
    };
}

function allPages(snapshot: CombinedReportSnapshot): string {
    return planCombinedReportPreviewPages(snapshot)
        .map((_, index) => renderToStaticMarkup(<CombinedReportPage report={snapshot} pageNumber={index + 1} pageIndex={index} />))
        .join('\n');
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

describe('CombinedReportPage', () => {
    it.each(['perProject', 'merged'] as const)('%s: real rates, My Mehnat table, letterhead', (layout) => {
        const html = allPages(report(layout));
        const plain = text(html);
        expect(html).toContain('tt-inv-creport__logo');
        expect(plain).toContain('My Mehnat');
        expect(plain).toContain('Per entry');
        expect(plain).not.toMatch(/1 ?455 ?952/);
        expect(plain).not.toMatch(/575 ?000/);
        expect(plain).toMatch(/1 ?500 ?000/);
        expect(plain).toMatch(/230 ?000/);
        expect(plain).toContain('1 × entry');
    });

    it('shows the letterhead only on the first page', () => {
        const snapshot = report('perProject');
        const first = renderToStaticMarkup(<CombinedReportPage report={snapshot} pageNumber={1} pageIndex={0} />);
        expect(first.indexOf('tt-inv-creport__logo')).toBeLessThan(first.indexOf('Private and confidential'));
        const pages = planCombinedReportPreviewPages(snapshot);
        for (let index = 1; index < pages.length; index += 1)
            expect(renderToStaticMarkup(<CombinedReportPage report={snapshot} pageNumber={index + 1} pageIndex={index} />)).not.toContain('tt-inv-creport__logo');
    });
});
