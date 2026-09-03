import { describe, expect, it } from 'vitest';
import { laptopRamUpgrade, parseRamGbFromNotes } from './laptopRamUpgrade';

const laptop = { categoryName: 'Ноутбуки' };

describe('parseRamGbFromNotes', () => {
    it('читает строку ОЗУ из автоинвентаризации', () => {
        expect(parseRamGbFromNotes('ОЗУ: 7.7 ГБ\nДиск: 238.5 ГБ')).toBe(7.7);
        expect(parseRamGbFromNotes('ОЗУ: 16 ГБ')).toBe(16);
    });
});

describe('laptopRamUpgrade', () => {
    it('не ставит метку не-ноутбукам', () => {
        expect(laptopRamUpgrade({ ...laptop, categoryName: 'Настольные ПК', name: 'HP ProBook 450 G9' })).toBeNull();
    });

    it('ThinkPad E15 20TD — слот есть', () => {
        const r = laptopRamUpgrade({
            ...laptop,
            name: 'LENOVO 20TD006LUE',
            inventory_number: 'NB-PF3HKKR2',
            description: 'ОЗУ: 7.7 ГБ',
        });
        expect(r?.canAddRam).toBe(true);
    });

    it('второй ThinkPad с серийником PF3H', () => {
        const r = laptopRamUpgrade({
            ...laptop,
            name: 'LENOVO SL11B03796',
            serial_number: 'PF3HLAXD',
            inventory_number: 'NB-PF3HLAXD',
        });
        expect(r?.canAddRam).toBe(true);
    });

    it('ProBook и Aspire A515-57 — слоты есть', () => {
        expect(laptopRamUpgrade({ ...laptop, name: 'HP ProBook 450 15.6 inch G9' })?.canAddRam).toBe(true);
        expect(laptopRamUpgrade({ ...laptop, name: 'Acer Aspire A515-57' })?.canAddRam).toBe(true);
    });

    it('Envy x360, OmniBook, Aspire A515-58M — память распаяна', () => {
        expect(laptopRamUpgrade({ ...laptop, name: 'HP Envy x360' })).toBeNull();
        expect(laptopRamUpgrade({ ...laptop, name: 'HP HP Envy x360 2-in-1 Laptop 14-es1xxx' })).toBeNull();
        expect(laptopRamUpgrade({ ...laptop, name: 'HP omnibook' })).toBeNull();
        expect(laptopRamUpgrade({ ...laptop, name: 'Acer Aspire A515-58M' })).toBeNull();
    });

    it('LPDDR в заметках перекрывает название линейки', () => {
        expect(laptopRamUpgrade({
            ...laptop,
            name: 'HP ProBook mystery',
            description: 'LPDDR5 16 ГБ',
        })).toBeNull();
    });
});
