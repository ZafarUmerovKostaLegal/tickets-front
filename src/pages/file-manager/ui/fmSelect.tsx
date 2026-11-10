import { SearchableSelect } from '@shared/ui';
import { useFm } from './fmShared';

export type FmSelectOption = { value: string; label: string };

type Props = {
    value: string;
    options: readonly FmSelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    disabled?: boolean;
    portalDropdown?: boolean;
    portalMinWidth?: number;
    portalMaxHeight?: number;
};

export function FmSelect({
    value,
    options,
    onChange,
    placeholder,
    className,
    buttonClassName,
    disabled,
    portalDropdown = true,
    portalMinWidth = 360,
    portalMaxHeight = 280,
}: Props) {
    const { tr } = useFm();
    return (
        <SearchableSelect
            value={value}
            items={options}
            disabled={disabled}
            className={['fm-filter-select', className].filter(Boolean).join(' ')}
            buttonClassName={buttonClassName}
            portalDropdown={portalDropdown}
            portalDropdownClassName="fm-filter-select__menu"
            portalZIndex={2200}
            portalMinWidth={portalMinWidth}
            portalMaxHeight={portalMaxHeight}
            getOptionValue={(item) => item.value}
            getOptionLabel={(item) => item.label}
            getSearchText={(item) => item.label}
            onSelect={(item) => onChange(item.value)}
            placeholder={placeholder ?? tr('common.empty')}
            emptyListText={tr('common.empty')}
            noMatchText={tr('directory.filterNoMatch')}
        />
    );
}
