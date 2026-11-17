import {
    EQUIPMENT_TIERS,
    equipmentTierByCode,
    isEquipmentClassCode,
    type EquipmentClassCode,
    type EquipmentTier,
} from './equipmentClasses';

export const EQUIPMENT_SCORE_MAX = 10;

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export type EquipmentScoreSource = 'purchase_date' | 'class';

export type EquipmentScoreResult = {
    score: number;
    tier: EquipmentTier;
    source: EquipmentScoreSource;
};

export type EquipmentScoreInput = {
    equipment_class?: string | null;
    purchase_date?: string | null;
};

export function equipmentAgeYears(purchaseDate: string | null | undefined, now: Date = new Date()): number | null {
    if (!purchaseDate)
        return null;
    const ms = new Date(purchaseDate).getTime();
    if (!Number.isFinite(ms))
        return null;
    return Math.max(0, (now.getTime() - ms) / MS_PER_YEAR);
}

export function equipmentScoreFromAgeYears(years: number): number {
    const age = Math.max(0, years);
    for (const tier of EQUIPMENT_TIERS) {
        if (age >= tier.toYears)
            continue;
        const span = tier.toYears - tier.fromYears;
        const half = Number.isFinite(span) ? tier.fromYears + span / 2 : tier.fromYears + 2;
        return age < half ? tier.maxScore : tier.minScore;
    }
    return EQUIPMENT_TIERS[EQUIPMENT_TIERS.length - 1].minScore;
}

export function equipmentScoreTier(score: number): EquipmentTier {
    return EQUIPMENT_TIERS.find((t) => score >= t.minScore && score <= t.maxScore)
        ?? EQUIPMENT_TIERS[EQUIPMENT_TIERS.length - 1];
}

export function equipmentScoreToClassCode(score: number): EquipmentClassCode {
    return equipmentScoreTier(score).code;
}


export function resolveEquipmentScore(item: EquipmentScoreInput, now?: Date): EquipmentScoreResult | null {
    const years = equipmentAgeYears(item.purchase_date, now);
    if (years != null) {
        const score = equipmentScoreFromAgeYears(years);
        return { score, tier: equipmentScoreTier(score), source: 'purchase_date' };
    }
    const raw = item.equipment_class?.trim().toUpperCase();
    if (raw && isEquipmentClassCode(raw)) {
        const tier = equipmentTierByCode(raw)!;
        return { score: tier.maxScore, tier, source: 'class' };
    }
    return null;
}

export function equipmentScoreText(score: number): string {
    return `${score} / ${EQUIPMENT_SCORE_MAX}`;
}

export function equipmentScoreTitle(result: EquipmentScoreResult): string {
    const base = `${equipmentScoreText(result.score)} — ${result.tier.summary}`;
    return result.source === 'purchase_date'
        ? `${base}. Рассчитано по дате покупки`
        : `${base}. Дата покупки не указана, оценка приблизительная`;
}

export type EquipmentScoreRangeOption = {
    code: EquipmentClassCode;
    range: string;
    short: string;
    summary: string;
};

export const EQUIPMENT_SCORE_RANGES: EquipmentScoreRangeOption[] = EQUIPMENT_TIERS.map((tier) => ({
    code: tier.code,
    range: `${tier.minScore}–${tier.maxScore}`,
    short: tier.short,
    summary: tier.summary,
}));

export const EQUIPMENT_SCORE_POINTS: number[] = Array.from(
    { length: EQUIPMENT_SCORE_MAX },
    (_, i) => EQUIPMENT_SCORE_MAX - i,
);

export function itemMatchesEquipmentScore(
    item: EquipmentScoreInput,
    score: number,
    now?: Date,
): boolean {
    const resolved = resolveEquipmentScore(item, now);
    return resolved != null && resolved.score === score;
}

export type EquipmentScoreSort = 'asc' | 'desc';

export function compareItemsByEquipmentScore(
    a: EquipmentScoreInput,
    b: EquipmentScoreInput,
    order: EquipmentScoreSort,
    now?: Date,
): number {
    const sa = resolveEquipmentScore(a, now)?.score ?? null;
    const sb = resolveEquipmentScore(b, now)?.score ?? null;
    if (sa == null && sb == null)
        return 0;
    if (sa == null)
        return 1;
    if (sb == null)
        return -1;
    return order === 'asc' ? sa - sb : sb - sa;
}
