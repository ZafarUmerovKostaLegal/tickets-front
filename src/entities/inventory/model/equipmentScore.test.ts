import { describe, expect, it } from 'vitest';
import {
    equipmentAgeYears,
    equipmentScoreFromAgeYears,
    equipmentScoreToClassCode,
    resolveEquipmentScore,
} from './equipmentScore';

const NOW = new Date('2026-08-24T00:00:00.000Z');

describe('equipmentScoreFromAgeYears', () => {
    it('маппит возраст в 10 баллов монотонно', () => {
        expect(equipmentScoreFromAgeYears(0)).toBe(10);
        expect(equipmentScoreFromAgeYears(0.7)).toBe(9);
        expect(equipmentScoreFromAgeYears(1.2)).toBe(8);
        expect(equipmentScoreFromAgeYears(1.8)).toBe(7);
        expect(equipmentScoreFromAgeYears(2.5)).toBe(6);
        expect(equipmentScoreFromAgeYears(3.5)).toBe(5);
        expect(equipmentScoreFromAgeYears(4.5)).toBe(4);
        expect(equipmentScoreFromAgeYears(5.5)).toBe(3);
        expect(equipmentScoreFromAgeYears(7)).toBe(2);
        expect(equipmentScoreFromAgeYears(12)).toBe(1);
    });

    it('обрабатывает отрицательный возраст как новую технику', () => {
        expect(equipmentScoreFromAgeYears(-3)).toBe(10);
    });
});

describe('equipmentScoreToClassCode', () => {
    it('складывает баллы в буквы, которые ждёт бэкенд', () => {
        expect(equipmentScoreToClassCode(10)).toBe('A');
        expect(equipmentScoreToClassCode(9)).toBe('A');
        expect(equipmentScoreToClassCode(8)).toBe('B');
        expect(equipmentScoreToClassCode(6)).toBe('C');
        expect(equipmentScoreToClassCode(4)).toBe('D');
        expect(equipmentScoreToClassCode(1)).toBe('E');
    });
});

describe('equipmentAgeYears', () => {
    it('возвращает null без даты или при мусоре', () => {
        expect(equipmentAgeYears(null, NOW)).toBeNull();
        expect(equipmentAgeYears('', NOW)).toBeNull();
        expect(equipmentAgeYears('не дата', NOW)).toBeNull();
    });

    it('считает возраст в годах', () => {
        expect(equipmentAgeYears('2024-08-24T00:00:00.000Z', NOW)).toBeCloseTo(2, 1);
    });
});

describe('resolveEquipmentScore', () => {
    it('считает точный балл по дате покупки', () => {
        const res = resolveEquipmentScore({ purchase_date: '2026-01-15T00:00:00.000Z', equipment_class: 'E' }, NOW);
        expect(res).toMatchObject({ score: 9, source: 'purchase_date' });
        expect(res?.tier.code).toBe('A');
    });

    it('без даты берёт верхний балл диапазона из буквы', () => {
        const res = resolveEquipmentScore({ purchase_date: null, equipment_class: 'C' }, NOW);
        expect(res).toMatchObject({ score: 6, source: 'class' });
    });

    it('возвращает null, если нет ни даты, ни валидной буквы', () => {
        expect(resolveEquipmentScore({ purchase_date: null, equipment_class: null }, NOW)).toBeNull();
        expect(resolveEquipmentScore({ equipment_class: 'Z' }, NOW)).toBeNull();
    });
});
