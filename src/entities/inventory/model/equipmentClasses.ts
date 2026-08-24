/**
 * Формат хранения оценки на бэкенде — одна буква A–E. Менять его нельзя: поле
 * equipment_class валидируется API и используется в серверном фильтре списка.
 * Пользователю оценка показывается по 10-балльной шкале (см. equipmentScore.ts):
 * буква задаёт диапазон оценки, точный балл считается по дате покупки.
 */
export type EquipmentClassCode = 'A' | 'B' | 'C' | 'D' | 'E';

export type EquipmentTier = {
    code: EquipmentClassCode;
    /** Диапазон 10-балльной оценки, который покрывает эта буква. */
    minScore: number;
    maxScore: number;
    /** Возраст техники в годах: [fromYears, toYears). */
    fromYears: number;
    toYears: number;
    short: string;
    summary: string;
};

export const EQUIPMENT_TIERS: EquipmentTier[] = [
    { code: 'A', minScore: 9, maxScore: 10, fromYears: 0, toYears: 1, short: 'новая', summary: 'Новая техника (до 1 года)' },
    { code: 'B', minScore: 7, maxScore: 8, fromYears: 1, toYears: 2, short: 'актуальная', summary: 'Актуальная (1–2 года)' },
    { code: 'C', minScore: 5, maxScore: 6, fromYears: 2, toYears: 4, short: 'рабочая', summary: 'Рабочая (2–4 года)' },
    { code: 'D', minScore: 3, maxScore: 4, fromYears: 4, toYears: 6, short: 'устаревающая', summary: 'Устаревающая (4–6 лет)' },
    { code: 'E', minScore: 1, maxScore: 2, fromYears: 6, toYears: Infinity, short: 'к списанию', summary: 'К списанию (6+ лет)' },
];

export function isEquipmentClassCode(value: string): value is EquipmentClassCode {
    return EQUIPMENT_TIERS.some((t) => t.code === value);
}

export function equipmentTierByCode(code: string | null | undefined): EquipmentTier | null {
    const raw = code?.trim().toUpperCase();
    if (!raw)
        return null;
    return EQUIPMENT_TIERS.find((t) => t.code === raw) ?? null;
}
