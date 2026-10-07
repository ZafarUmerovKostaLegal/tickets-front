import { EQUIPMENT_TIERS, equipmentTierByCode, isEquipmentClassCode, } from './equipmentClasses';
export const EQUIPMENT_SCORE_MAX = 10;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
/** Возраст техники в годах; null, если дата покупки не заполнена или не парсится. */
export function equipmentAgeYears(purchaseDate, now = new Date()) {
    if (!purchaseDate)
        return null;
    const ms = new Date(purchaseDate).getTime();
    if (!Number.isFinite(ms))
        return null;
    return Math.max(0, (now.getTime() - ms) / MS_PER_YEAR);
}
/** Балл 10 (новая) … 1 (к списанию): внутри диапазона буквы делим по половине срока. */
export function equipmentScoreFromAgeYears(years) {
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
export function equipmentScoreTier(score) {
    return EQUIPMENT_TIERS.find((t) => score >= t.minScore && score <= t.maxScore)
        ?? EQUIPMENT_TIERS[EQUIPMENT_TIERS.length - 1];
}
/** Буква для сохранения: балл превращаем в диапазон, который понимает бэкенд. */
export function equipmentScoreToClassCode(score) {
    return equipmentScoreTier(score).code;
}
/**
 * Оценка предмета: если известна дата покупки — считаем точный балл по возрасту,
 * иначе берём верхний балл диапазона из сохранённой буквы.
 */
export function resolveEquipmentScore(item, now) {
    const years = equipmentAgeYears(item.purchase_date, now);
    if (years != null) {
        const score = equipmentScoreFromAgeYears(years);
        return { score, tier: equipmentScoreTier(score), source: 'purchase_date' };
    }
    const raw = item.equipment_class?.trim().toUpperCase();
    if (raw && isEquipmentClassCode(raw)) {
        const tier = equipmentTierByCode(raw);
        return { score: tier.maxScore, tier, source: 'class' };
    }
    return null;
}
export function equipmentScoreText(score) {
    return `${score} / ${EQUIPMENT_SCORE_MAX}`;
}
export function equipmentScoreTitle(result) {
    const base = `${equipmentScoreText(result.score)} — ${result.tier.summary}`;
    return result.source === 'purchase_date'
        ? `${base}. Рассчитано по дате покупки`
        : `${base}. Дата покупки не указана, оценка приблизительная`;
}
/** Варианты для ручного выбора и фильтра по диапазону: пользователь видит баллы, уходит буква. */
export const EQUIPMENT_SCORE_RANGES = EQUIPMENT_TIERS.map((tier) => ({
    code: tier.code,
    range: `${tier.minScore}–${tier.maxScore}`,
    short: tier.short,
    summary: tier.summary,
}));
/** Точные баллы 10…1 для фильтра списка (как в колонке «Оценка»). */
export const EQUIPMENT_SCORE_POINTS = Array.from({ length: EQUIPMENT_SCORE_MAX }, (_, i) => EQUIPMENT_SCORE_MAX - i);
export function itemMatchesEquipmentScore(item, score, now) {
    const resolved = resolveEquipmentScore(item, now);
    return resolved != null && resolved.score === score;
}
/** Sort by resolved score; items without a score go last. */
export function compareItemsByEquipmentScore(a, b, order, now) {
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
