import { DatePicker } from '@shared/ui';

type ReportPreviewRuDateFieldProps = {
    value: string;
    onChange: (ymd: string) => void;
    min?: string;
    max?: string;
    disabled?: boolean;
    id?: string;
    'aria-labelledby'?: string;
    title?: string;
    variant?: 'brief' | 'table' | 'dialog';
};


export function ReportPreviewRuDateField({
    value,
    onChange,
    min,
    max,
    disabled,
    id,
    'aria-labelledby': ariaLabelledBy,
    title,
    variant = 'table',
}: ReportPreviewRuDateFieldProps) {
    const wrapClass = variant === 'brief'
        ? 'tt-rp-brief-dt__date-picker'
        : variant === 'dialog'
            ? 'tt-rp-dup-dt__date-picker'
            : 'tt-rp-mtable__date-picker';
    const buttonClass = [
        'tt-rp-ru-date-btn',
        variant === 'brief' ? 'tt-rp-brief-dt__date-btn' : '',
        variant === 'dialog' ? 'tt-rp-mtable__input tt-rp-mtable__input--emp' : '',
        variant === 'table' ? 'tt-rp-mtable__input--date' : '',
    ].filter(Boolean).join(' ');

    return (
        <DatePicker
            id={id}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            disabled={disabled}
            portal
            portalZIndex={15000}
            showChevron={false}
            iconAfterLabel
            aria-labelledby={ariaLabelledBy}
            className={wrapClass}
            buttonClassName={buttonClass}
            title={title ?? 'Выбрать дату'}
        />
    );
}
