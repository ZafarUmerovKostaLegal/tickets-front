import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export function KostaDailyPinnedBar({ pins, canUnpin, onOpen, onUnpin }) {
    const [index, setIndex] = useState(0);
    const pinKey = pins.map((pin) => pin.message_id).join(',');
    useEffect(() => {
        setIndex(0);
    }, [pinKey]);
    if (pins.length === 0)
        return null;
    const current = pins[Math.min(index, pins.length - 1)] ?? pins[0];
    if (!current)
        return null;
    return (_jsxs("div", { className: "kd-tg__pinbar", children: [_jsxs("button", { type: "button", className: "kd-tg__pinbar-main", onClick: () => {
                    onOpen(current.message_id);
                    if (pins.length > 1)
                        setIndex((value) => (value + 1) % pins.length);
                }, children: [_jsx("span", { className: "kd-tg__pinbar-rails", "aria-hidden": true, children: pins.map((pin, pinIndex) => (_jsx("span", { className: `kd-tg__pinbar-rail${pinIndex === Math.min(index, pins.length - 1) ? ' kd-tg__pinbar-rail--on' : ''}` }, pin.message_id))) }), _jsxs("span", { className: "kd-tg__pinbar-copy", children: [_jsxs("span", { className: "kd-tg__pinbar-label", children: ["\u0417\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435", pins.length > 1 ? ` · ${Math.min(index, pins.length - 1) + 1} из ${pins.length}` : ''] }), _jsx("span", { className: "kd-tg__pinbar-preview", children: current.preview || 'Сообщение' })] })] }), canUnpin ? (_jsx("button", { type: "button", className: "kd-tg__pinbar-unpin", "aria-label": "\u041E\u0442\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435", title: "\u041E\u0442\u043A\u0440\u0435\u043F\u0438\u0442\u044C", onClick: () => onUnpin(current.message_id), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M18 6 6 18M6 6l12 12" }) }) })) : null] }));
}
