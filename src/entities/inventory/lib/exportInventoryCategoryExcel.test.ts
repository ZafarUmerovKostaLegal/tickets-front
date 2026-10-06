import { describe, expect, it } from 'vitest';
import { buildInventoryCategoryExcelRows } from './exportInventoryCategoryExcel';
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
            'Офисный',
        ].join('\n'),
        category_id: 5,
        photo_path: null,
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

describe('buildInventoryCategoryExcelRows', () => {
    it('maps monitor specs and score into export columns', () => {
        const rows = buildInventoryCategoryExcelRows([item()], {
            categoryName: 'Мониторы',
            statusLabel: (s) => (s === 'in_stock' ? 'На складе' : s),
            userLabel: () => '',
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]!.inventory_number).toBe('mnx29');
        expect(rows[0]!.status).toBe('На складе');
        expect(rows[0]!.score).toBe('10/10');
        expect(String(rows[0]!.specs)).toContain('23.8');
        expect(rows[0]!.notes).toBe('Офисный');
    });
});
