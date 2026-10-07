import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { formatDecimalHoursAsHm, parseStrictDurationInputToDecimalHours, roundDecimalHoursToMinute, sanitizeColonHoursInput, } from '@shared/lib/formatTrackingHours';
export function DecimalDurationInput({ valueHours, onCommit, className, disabled = false, 'aria-label': ariaLabel, }) {
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
        const h = parseStrictDurationInputToDecimalHours(t);
        if (h === null) {
            setText(formatDecimalHoursAsHm(valueHours));
            return;
        }
        const rounded = roundDecimalHoursToMinute(h);
        onCommit(rounded);
        setText(formatDecimalHoursAsHm(rounded));
    };
    return (_jsx("input", { type: "text", className: className, inputMode: "numeric", autoComplete: "off", spellCheck: false, disabled: disabled, placeholder: "0:00", title: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: 035 (0:35), 112 (1:12) \u0438\u043B\u0438 7:30", "aria-label": ariaLabel, value: text, onFocus: () => {
            setEditing(true);
            setText(formatDecimalHoursAsHm(valueHours));
        }, onChange: (e) => setText(sanitizeColonHoursInput(e.target.value)), onBlur: () => {
            if (skipBlurCommit.current) {
                skipBlurCommit.current = false;
                setEditing(false);
                return;
            }
            commit();
            setEditing(false);
        }, onKeyDown: (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
                return;
            }
            if (e.key === 'Escape') {
                skipBlurCommit.current = true;
                setText(formatDecimalHoursAsHm(valueHours));
                setEditing(false);
                e.target.blur();
            }
        } }));
}
