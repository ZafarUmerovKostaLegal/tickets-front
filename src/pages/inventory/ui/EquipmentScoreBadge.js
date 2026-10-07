import { jsx as _jsx } from "react/jsx-runtime";
import { equipmentScoreText, equipmentScoreTitle, resolveEquipmentScore, EQUIPMENT_SCORE_MAX } from '@entities/inventory';
export function EquipmentScoreBadge({ item, compact = false }) {
    const result = resolveEquipmentScore(item);
    if (!result)
        return _jsx("span", { className: "inv__score-badge inv__score-badge--empty", children: "\u2014" });
    const approx = result.source === 'class';
    return (_jsx("span", { className: `inv__score-badge inv__score-badge--${result.tier.code}${approx ? ' inv__score-badge--approx' : ''}`, title: equipmentScoreTitle(result), children: compact ? `${result.score}/${EQUIPMENT_SCORE_MAX}` : equipmentScoreText(result.score) }));
}
