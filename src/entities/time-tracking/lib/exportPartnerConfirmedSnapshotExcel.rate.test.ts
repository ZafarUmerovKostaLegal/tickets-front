import { describe, expect, it } from 'vitest';
import type { ReportSnapshot } from '../api';
import { loadExcelJS } from '@shared/lib/exceljsLoader';
import {
    buildPartnerConfirmedSnapshotExcel,
    pickExcelSummaryHourlyRate,
    type PartnerConfirmedExcelFallbackRow,
} from './exportPartnerConfirmedSnapshotExcel';

describe('pickExcelSummaryHourlyRate', () => {
    it('uses the position rate instead of billed amount divided by hours', () => {
        const hours = 7.08;
        const amount = 2327.48;
        expect(Math.round((amount / hours) * 100) / 100).toBe(328.74);
        expect(pickExcelSummaryHourlyRate({
            title: 'Partner',
            hours,
            amount,
            hoursByRate: new Map([[350, hours]]),
            positionRates: [{ position: 'Partner', rate: 350 }],
        })).toBe(350);
    });

    it('uses the position rate when line rates were already derived from amount/hours', () => {
        expect(pickExcelSummaryHourlyRate({
            title: 'Junior Associate',
            hours: 29.15,
            amount: 3439.70,
            hoursByRate: new Map([[118, 29.15]]),
            positionRates: [{ position: 'Junior Associate', rate: 160 }],
        })).toBe(160);
    });

    it('falls back to the rate on the hours when the title is not in the position table', () => {
        expect(pickExcelSummaryHourlyRate({
            title: 'Harvest import',
            hours: 4,
            amount: 800,
            hoursByRate: new Map([[280, 4]]),
            positionRates: [{ position: 'Partner', rate: 350 }],
        })).toBe(280);
    });
});

function fallbackRow(partial: Partial<PartnerConfirmedExcelFallbackRow> & Pick<PartnerConfirmedExcelFallbackRow, 'employeeName' | 'authUserId'>): PartnerConfirmedExcelFallbackRow {
    return {
        rowKind: 'entry',
        workDate: '2026-03-12',
        employeeInitials: '',
        employeePosition: 'Partner',
        taskName: 'Advice',
        note: '',
        hours: 7.08,
        billableHours: 7.08,
        billableRate: 350,
        amountToPay: 2327.48,
        isVoided: false,
        timeEntryId: `e-${partial.authUserId}`,
        ...partial,
    };
}

function previewSnapshot(): ReportSnapshot {
    return {
        id: 'preview-export',
        name: 'AMEA Power - AMEA BESS',
        reportType: 'time',
        groupBy: 'projects',
        filters: {},
        version: 1,
        createdByUserId: 0,
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: null,
        rowCount: 0,
    };
}

describe('buildPartnerConfirmedSnapshotExcel summary rates', () => {
    it('writes contractual rates in the summary and keeps package-adjusted amounts', async () => {
        const { blob } = await buildPartnerConfirmedSnapshotExcel(previewSnapshot(), {
            preferPageRows: true,
            fallbackTimeRows: [
                fallbackRow({
                    employeeName: 'Azizbek Akhmadjonov',
                    authUserId: 1,
                    employeeInitials: 'AAA',
                    employeePosition: 'Partner',
                    hours: 7.08,
                    billableHours: 7.08,
                    billableRate: 350,
                    amountToPay: 2327.48,
                }),
                fallbackRow({
                    employeeName: 'Shukhrat Yunusov',
                    authUserId: 2,
                    employeeInitials: 'SHMYU',
                    employeePosition: 'Partner',
                    hours: 13.83,
                    billableHours: 13.83,
                    billableRate: 350,
                    amountToPay: 4840.50,
                    timeEntryId: 'e-2',
                }),
                fallbackRow({
                    employeeName: 'Kamila Djabbarova',
                    authUserId: 3,
                    employeeInitials: 'KSHD',
                    employeePosition: 'Junior Associate',
                    hours: 29.15,
                    billableHours: 29.15,
                    billableRate: 118,
                    amountToPay: 3439.70,
                    timeEntryId: 'e-3',
                }),
            ],
            positionRateRows: [
                { position: 'Partner', rate: 350 },
                { position: 'Junior Associate', rate: 160 },
            ],
        });

        const ExcelJS = await loadExcelJS();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await blob.arrayBuffer());
        const ws = wb.getWorksheet('Report');
        expect(ws).toBeTruthy();

        let headerRow = 0;
        ws!.eachRow((row, rowNumber) => {
            if (row.getCell(5).value === 'Rate (USD)')
                headerRow = rowNumber;
        });
        expect(headerRow).toBeGreaterThan(0);

        const azizbek = ws!.getRow(headerRow + 1);
        const shukhrat = ws!.getRow(headerRow + 2);
        const kamila = ws!.getRow(headerRow + 3);

        expect(azizbek.getCell(1).value).toBe('AAA');
        expect(azizbek.getCell(5).value).toBe(350);
        expect(azizbek.getCell(6).value).toBe(2327.48);

        expect(shukhrat.getCell(5).value).toBe(350);
        expect(shukhrat.getCell(6).value).toEqual({ formula: `D${headerRow + 2}*E${headerRow + 2}` });

        expect(kamila.getCell(1).value).toBe('KSHD');
        expect(kamila.getCell(5).value).toBe(160);
        expect(kamila.getCell(6).value).toBe(3439.70);
    });
});
