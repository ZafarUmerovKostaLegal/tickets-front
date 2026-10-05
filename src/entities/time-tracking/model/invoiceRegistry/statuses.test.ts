import { describe, expect, it } from 'vitest';
import year2026 from './seed/year-2026.json';
import { getInvoiceRegistrySheet } from './columns';
import { collectRegistryStatusOptions, registryStatusToneClass } from './statuses';
import type { InvoiceRegistryRow } from './types';

const rows = year2026 as InvoiceRegistryRow[];
const CANONICAL_PARTNERS = new Set(['', 'AAA', 'VGB', 'NFH', 'MAD', 'SHMYU']);

describe('registry status tones', () => {
    it('colors the manual registry statuses', () => {
        expect(registryStatusToneClass('Черновик')).toBe('tt-inv-reg-status--draft');
        expect(registryStatusToneClass('На согласовании с Клиентом')).toBe('tt-inv-reg-status--review');
        expect(registryStatusToneClass('Выставлен')).toBe('tt-inv-reg-status--issued');
        expect(registryStatusToneClass('Оплачен')).toBe('tt-inv-reg-status--paid');
        expect(registryStatusToneClass('')).toBe('tt-inv-reg-status--empty');
    });

    it('colors every status a system invoice can show', () => {
        expect(registryStatusToneClass('Отправлен')).toBe('tt-inv-reg-status--issued');
        expect(registryStatusToneClass('Просмотрен')).toBe('tt-inv-reg-status--issued');
        expect(registryStatusToneClass('Частично оплачен')).toBe('tt-inv-reg-status--review');
        expect(registryStatusToneClass('Просрочен')).toBe('tt-inv-reg-status--review');
        expect(registryStatusToneClass('Отменён')).toBe('tt-inv-reg-status--canceled');
    });

    it('keeps a free-text Excel note visibly different from the fixed list', () => {
        expect(registryStatusToneClass('Ольге направила')).toBe('tt-inv-reg-status--legacy');
    });

    it('offers the old Excel phrases next to the fixed statuses', () => {
        const options = collectRegistryStatusOptions([
            'Ольге направила',
            'жду подтверждения от клиента',
            'Выставили этот инвойс в феврале 2026 года',
        ]);
        expect(options.slice(0, 4)).toEqual([
            'Черновик',
            'На согласовании с Клиентом',
            'Выставлен',
            'Оплачен',
        ]);
        expect(options).not.toContain('Ольге направила');
        expect(options).not.toContain('Попросил выставить в октябре');
        expect(options).not.toContain('Просмотрен');
        expect(options).toContain('Аннулирован');
        expect(options).toContain('Выставили этот инвойс в феврале 2026 года');
    });
});

describe('manual 2026 registry seed', () => {
    it('has no empty rows and numbers them from 1 without gaps', () => {
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach((row, index) => {
            expect(row.seqNo).toBe(String(index + 1));
            expect(row.id).toBe(`2026-${String(index + 1).padStart(4, '0')}`);
            const filled = ['billedTo', 'currency', 'amount', 'details', 'partner', 'issueDate', 'clientNumber']
                .some((key) => String(row[key] ?? '').trim());
            expect(filled).toBe(true);
        });
    });

    it('stores partner initials only in the canonical codes', () => {
        const partners = new Set(rows.map((row) => row.partner));
        for (const code of partners)
            expect(CANONICAL_PARTNERS.has(code)).toBe(true);
        expect(partners.has('VG') || partners.has('AA') || partners.has('ShYu')).toBe(false);
    });
});

describe('2026 system sheet', () => {
    it('is a separate read-model tab with the same columns as the manual 2026 sheet', () => {
        const manual = getInvoiceRegistrySheet('2026');
        const system = getInvoiceRegistrySheet('2026-system');
        expect(system.sheetName).toBe('2026 (система)');
        expect(system.columns.map((column) => column.key)).toEqual([
            ...manual.columns.map((column) => column.key),
            'invoicePdf',
        ]);
        expect(system.columns.at(-1)?.editor).toBe('pdf');
    });

    it('keeps a status column on the older manual years', () => {
        for (const year of ['2025', '2024', '2023', '2022', '2021', '2020'] as const) {
            const sheet = getInvoiceRegistrySheet(year);
            expect(sheet.columns.some((column) => column.key === 'statusNote' && column.editor === 'status')).toBe(true);
        }
    });
});
