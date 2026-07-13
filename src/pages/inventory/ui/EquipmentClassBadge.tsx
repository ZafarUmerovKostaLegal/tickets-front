import { equipmentClassLabel } from '@entities/inventory';

type Props = {
    code: string | null | undefined;
    compact?: boolean;
};

export function EquipmentClassBadge({ code, compact = false }: Props) {
    if (!code?.trim())
        return <span className="inv__class-badge inv__class-badge--empty">—</span>;

    const letter = code.trim().toUpperCase();
    const label = compact ? letter : equipmentClassLabel(letter);

    return (
        <span
            className={`inv__class-badge inv__class-badge--${letter}`}
            title={equipmentClassLabel(letter)}
        >
            {label}
        </span>
    );
}
