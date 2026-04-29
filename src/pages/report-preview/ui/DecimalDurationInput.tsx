import { useEffect, useRef, useState } from 'react';
import { formatDecimalHoursAsHm, parseDecimalHoursFromDurationText, } from '@shared/lib/formatTrackingHours';
type Props = {
    valueHours: number;
    onCommit: (hours: number) => void;
    'aria-label'?: string;
    className?: string;
    disabled?: boolean;
};
export function DecimalDurationInput({ valueHours, onCommit, className, disabled = false, 'aria-label': ariaLabel, }: Props) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(() => formatDecimalHoursAsHm(valueHours));
    const skipBlurCommit = useRef(false);
    useEffect(() => {
        if (!editing)
            setText(formatDecimalHoursAsHm(valueHours));
    }, [valueHours, editing]);
    const commit = () => {
        const t = text.trim();
        if (t === '') {
            onCommit(0);
            setText('0:00');
            return;
        }
        const h = parseDecimalHoursFromDurationText(t);
        if (h === null) {
            setText(formatDecimalHoursAsHm(valueHours));
            return;
        }
        onCommit(h);
        setText(formatDecimalHoursAsHm(h));
    };
    return (<input type="text" className={className} inputMode="text" autoComplete="off" spellCheck={false} disabled={disabled} placeholder="ч:мм" title="Например: 7:30, 0:15 или 1,5 (десятичные часы)" aria-label={ariaLabel} value={text} onFocus={() => {
            setEditing(true);
            setText(formatDecimalHoursAsHm(valueHours));
        }} onChange={(e) => setText(e.target.value)} onBlur={() => {
            if (skipBlurCommit.current) {
                skipBlurCommit.current = false;
                setEditing(false);
                return;
            }
            commit();
            setEditing(false);
        }} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
                return;
            }
            if (e.key === 'Escape') {
                skipBlurCommit.current = true;
                setText(formatDecimalHoursAsHm(valueHours));
                setEditing(false);
                (e.target as HTMLInputElement).blur();
            }
        }}/>);
}
