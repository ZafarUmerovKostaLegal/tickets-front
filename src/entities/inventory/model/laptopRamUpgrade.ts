export type LaptopRamUpgradeInput = {
    name?: string | null;
    description?: string | null;
    serial_number?: string | null;
    inventory_number?: string | null;
    categoryName?: string | null;
};

export type LaptopRamUpgradeResult = {
    canAddRam: boolean;
    /** Короткая подсказка для title, если слот есть. */
    hint: string;
};

const LAPTOP_CATEGORY = /ноутбук/i;

/** Память на плате — слота нет. Более узкие шаблоны идут первыми. */
const SOLDERED: RegExp[] = [
    /envy/i,
    /spectre/i,
    /omnibook/i,
    /macbook/i,
    /surface/i,
    /\bxps\s*13\b/i,
    /yoga\s*(slim|[79])\b/i,
    /ideapad\s*slim/i,
    /a515-58/i,
    /pavilion.*x360/i,
    /\bx360\b/i,
    /x1\s*carbon/i,
    /t14s/i,
    /elitebook\s*x\b/i,
];

/** Есть SODIMM / комбинированный слот — можно добавить или заменить планку. */
const UPGRADEABLE: RegExp[] = [
    /thinkpad/i,
    /\b20td/i,
    /probook/i,
    /elitebook/i,
    /latitude/i,
    /vostro/i,
    /thinkbook/i,
    /a515-57/i,
    /a515-56/i,
    /a515-55/i,
    /a515-54/i,
    /a515-52/i,
];

function haystack(item: LaptopRamUpgradeInput): string {
    return [item.name, item.description, item.serial_number, item.inventory_number]
        .filter(Boolean)
        .join('\n');
}

function isLaptop(item: LaptopRamUpgradeInput): boolean {
    return LAPTOP_CATEGORY.test(item.categoryName ?? '');
}

export function parseRamGbFromNotes(text: string | null | undefined): number | null {
    if (!text)
        return null;
    const m = text.match(/озу[:\s]*([\d]+(?:[.,]\d+)?)\s*гб/i)
        ?? text.match(/ram[:\s]*([\d]+(?:[.,]\d+)?)\s*gb/i);
    if (!m)
        return null;
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(text));
}

/**
 * Метка «можно добавить ОЗУ» только если категория — ноутбук
 * и по модели/заметкам ясно, что есть пользовательский слот.
 * Неизвестные модели не помечаем.
 */
export function laptopRamUpgrade(item: LaptopRamUpgradeInput): LaptopRamUpgradeResult | null {
    if (!isLaptop(item))
        return null;

    const text = haystack(item);
    const notes = item.description ?? '';
    const ramGb = parseRamGbFromNotes(notes);

    if (/lpddr/i.test(notes) && !/sodimm/i.test(notes))
        return null;
    if (/распаян|soldered|on-?board memory|память на плате/i.test(notes) && !/sodimm|слот/i.test(notes))
        return null;

    if (matchesAny(text, SOLDERED))
        return null;

    const explicitSlot = /sodimm|so-dimm|слот(?:а|ов)?\s*(озу|памяти|ram)|можно добавить озу|upgradeable ram/i.test(text);
    const knownSlot = matchesAny(text, UPGRADEABLE)
        || (/lenovo/i.test(text) && /pf3h/i.test(text));

    if (!explicitSlot && !knownSlot)
        return null;

    const ramPart = ramGb != null ? `Сейчас ≈ ${String(ramGb).replace('.', ',')} ГБ. ` : '';
    return {
        canAddRam: true,
        hint: `${ramPart}В этой модели есть слот SODIMM — планку можно добавить или заменить.`,
    };
}
