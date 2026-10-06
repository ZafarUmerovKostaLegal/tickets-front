import { describe, expect, it } from 'vitest';
import {
    buildInventoryItemExportFields,
    buildInventoryItemExportText,
    inventoryItemExportStem,
} from './exportInventoryItemCard';
import type { InventoryItem } from '../model/types';

function item(over: Partial<InventoryItem> = {}): InventoryItem {
    return {
        id: 1,
        uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: 'Монитор Xiaomi',
        description: [
            'diagonal: 23.8"',
            'resolution: 1920×1080',
            'refresh: 75',
            'panel: IPS',
            'ports: HDMI, VGA',
            'vesa: yes',
            '---',
            'Офисный монитор',
        ].join('\n'),
        category_id: 1,
        photo_path: 'inventory/photos/x.jpg',
        serial_number: null,
        inventory_number: 'mnx29',
        equipment_class: 'A',
        status: 'in_stock',
        assigned_to_user_id: null,
        assigned_at: null,
        purchase_date: null,
        warranty_until: null,
        created_at: '2026-10-06T10:00:00Z',
        updated_at: '2026-10-06T10:00:00Z',
        is_archived: false,
        ...over,
    };
}

describe('inventoryItemExportStem', () => {
    it('builds a safe filename stem', () => {
        expect(inventoryItemExportStem(item())).toBe('mnx29_Монитор_Xiaomi');
        expect(inventoryItemExportStem(item({ name: 'a/b:c?' }))).toBe('mnx29_a_b_c');
    });
});

describe('buildInventoryItemExportFields / text', () => {
    it('includes core fields, score, monitor chips and notes', () => {
        const fields = buildInventoryItemExportFields({
            item: item(),
            categoryName: 'Мониторы',
            assignedLabel: null,
            statusLabel: 'На складе',
        });
        expect(fields.title).toBe('Монитор Xiaomi');
        expect(fields.monitorChips.some((c) => c.includes('23.8'))).toBe(true);
        expect(fields.notes).toBe('Офисный монитор');

        const text = buildInventoryItemExportText({
            item: item(),
            categoryName: 'Мониторы',
            assignedLabel: null,
            statusLabel: 'На складе',
        });
        expect(text).toContain('Инв. номер: mnx29');
        expect(text).toContain('Категория: Мониторы');
        expect(text).toContain('Статус: На складе');
        expect(text).toContain('Оценка техники: 10/10');
        expect(text).toContain('PDF или Word');
        expect(text).toContain('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });
});
