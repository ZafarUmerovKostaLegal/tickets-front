
export type EquipmentClassCode = 'A' | 'B' | 'C' | 'D' | 'E';

export type EquipmentClassOption = {
    value: EquipmentClassCode;
    label: string;
    hint: string;
};

export const EQUIPMENT_CLASSES: EquipmentClassOption[] = [
    { value: 'A', label: 'Класс A', hint: 'Новая техника (до 1 года)' },
    { value: 'B', label: 'Класс B', hint: 'Актуальная (1–2 года)' },
    { value: 'C', label: 'Класс C', hint: 'Рабочая (2–4 года)' },
    { value: 'D', label: 'Класс D', hint: 'Устаревающая (4–6 лет)' },
    { value: 'E', label: 'Класс E', hint: 'К списанию (6+ лет)' },
];

export function equipmentClassLabel(code: string | null | undefined): string {
    if (!code?.trim())
        return '—';
    const found = EQUIPMENT_CLASSES.find((c) => c.value === code);
    return found ? found.label : `Класс ${code}`;
}

export function equipmentClassHint(code: string | null | undefined): string | null {
    if (!code?.trim())
        return null;
    return EQUIPMENT_CLASSES.find((c) => c.value === code)?.hint ?? null;
}

export function isEquipmentClassCode(value: string): value is EquipmentClassCode {
    return EQUIPMENT_CLASSES.some((c) => c.value === value);
}
