import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { equipmentQrCodes, equipmentQrPublicUrl } from '@entities/inventory';
import { AppBackButton } from '@shared/ui';
import { equipmentQrSvg } from './equipmentQrSvg';
import './InventoryQrSheet.css';
const CODES = equipmentQrCodes();
const PER_PAGE = 24;
export function InventoryQrSheetPage({ embedded = false }) {
    const [readyCount, setReadyCount] = useState(0);
    const [svgs, setSvgs] = useState({});
    const [failed, setFailed] = useState(false);
    const pages = useMemo(() => {
        const chunks = [];
        for (let i = 0; i < CODES.length; i += PER_PAGE)
            chunks.push(CODES.slice(i, i + PER_PAGE));
        return chunks;
    }, []);
    useEffect(() => {
        let live = true;
        let index = 0;
        let timer = 0;
        const next = {};
        const step = () => {
            if (!live)
                return;
            const end = Math.min(index + PER_PAGE, CODES.length);
            try {
                for (; index < end; index += 1)
                    next[CODES[index]] = equipmentQrSvg(equipmentQrPublicUrl(CODES[index]));
            }
            catch {
                setFailed(true);
                return;
            }
            setSvgs({ ...next });
            setReadyCount(index);
            if (index < CODES.length)
                timer = window.setTimeout(step, 0);
        };
        const frame = window.requestAnimationFrame(step);
        return () => {
            live = false;
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, []);
    return (_jsxs("div", { className: "inv-qr", children: [_jsxs("div", { className: "inv-qr__toolbar", children: [embedded ? null : _jsx(AppBackButton, { className: "app-back-btn" }), _jsxs("div", { children: [_jsx("h1", { children: "QR \u0434\u043B\u044F \u0442\u0435\u0445\u043D\u0438\u043A\u0438" }), _jsx("p", { children: "24 \u043D\u0430\u043A\u043B\u0435\u0439\u043A\u0438 4\u00D74 \u0441\u043C \u043D\u0430 \u043B\u0438\u0441\u0442 A4. \u0412 \u043E\u043A\u043D\u0435 \u043F\u0435\u0447\u0430\u0442\u0438: \u043C\u0430\u0441\u0448\u0442\u0430\u0431 100%, \u043F\u043E\u043B\u044F \u00AB\u041D\u0435\u0442\u00BB." })] }), _jsx("button", { type: "button", onClick: () => window.print(), disabled: readyCount < CODES.length, children: readyCount < CODES.length ? `Готово ${readyCount} из ${CODES.length}` : 'Печать' })] }), failed ? _jsx("p", { className: "inv-qr__error", children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u043A\u043E\u0434\u044B." }) : null, _jsx("div", { className: "inv-qr__pages", children: pages.map((page) => (_jsx("section", { className: "inv-qr__page", children: page.map((code) => (_jsxs("figure", { className: "inv-qr__sticker", children: [svgs[code]
                                ? _jsx("div", { className: "inv-qr__mark", dangerouslySetInnerHTML: { __html: svgs[code] } })
                                : _jsx("div", { className: "inv-qr__mark inv-qr__mark--wait" }), _jsx("figcaption", { children: code })] }, code))) }, page[0]))) })] }));
}
