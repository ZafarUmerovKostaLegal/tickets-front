import { describe, expect, it } from 'vitest';
import { buildReportDownloadFilename, resolveReportDownloadLabelsFromExcelRows } from './reportDownloadFilename';

describe('buildReportDownloadFilename', () => {
    it('builds client - project - period xlsx name', () => {
        expect(buildReportDownloadFilename({
            clientName: 'Nur Bukhara Solar',
            projectName: 'Legal services',
            dateFrom: '2026-05-01',
            dateTo: '2026-06-30',
        })).toBe('Nur Bukhara Solar - Legal services - 2026-05-01-2026-06-30.xlsx');
    });

    it('supports csv extension', () => {
        expect(buildReportDownloadFilename({
            clientName: 'Client',
            projectName: 'Project',
            dateFrom: '2026-01-01',
            dateTo: '2026-01-31',
            extension: 'csv',
        })).toBe('Client - Project - 2026-01-01-2026-01-31.csv');
    });
});

describe('resolveReportDownloadLabelsFromExcelRows', () => {
    it('reads labels from first row with both names', () => {
        expect(resolveReportDownloadLabelsFromExcelRows([
            { clientName: '', projectName: 'A' },
            { clientName: 'Client', projectName: 'Project' },
        ])).toEqual({ clientName: 'Client', projectName: 'Project' });
    });
});
