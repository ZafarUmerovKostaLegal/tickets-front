import { equipmentScoreText, equipmentScoreTitle, resolveEquipmentScore, EQUIPMENT_SCORE_MAX, type EquipmentScoreInput } from '@entities/inventory';

type Props = {
    item: EquipmentScoreInput;
    compact?: boolean;
};

export function EquipmentScoreBadge({ item, compact = false }: Props) {
    const result = resolveEquipmentScore(item);
    if (!result)
        return <span className="inv__score-badge inv__score-badge--empty">—</span>;

    const approx = result.source === 'class';

    return (
        <span
            className={`inv__score-badge inv__score-badge--${result.tier.code}${approx ? ' inv__score-badge--approx' : ''}`}
            title={equipmentScoreTitle(result)}
        >
            {compact ? `${result.score}/${EQUIPMENT_SCORE_MAX}` : equipmentScoreText(result.score)}
        </span>
    );
}
