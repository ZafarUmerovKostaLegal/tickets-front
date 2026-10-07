import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
export function ReportsRowContextMenu({ menu, onClose, onOpen, onOpenNewTab, openLabel, openNewTabLabel, }) {
    useEffect(() => {
        if (!menu)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menu, onClose]);
    if (!menu || typeof document === 'undefined')
        return null;
    const MENU_W = 240;
    const MENU_H = 96;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.min(Math.max(menu.x, pad), vw - MENU_W - pad);
    const y = Math.min(Math.max(menu.y, pad), vh - MENU_H - pad);
    return createPortal(_jsx("div", { className: "tt-reports__ctx-overlay", role: "presentation", onClick: onClose, onContextMenu: (e) => {
            e.preventDefault();
            onClose();
        }, children: _jsxs("div", { className: "tt-reports__ctx-menu", style: { left: x, top: y }, role: "menu", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { type: "button", className: "tt-reports__ctx-item", role: "menuitem", onClick: () => {
                        onOpen(menu.kind, menu.id);
                        onClose();
                    }, children: openLabel }), _jsx("button", { type: "button", className: "tt-reports__ctx-item", role: "menuitem", onClick: () => {
                        onOpenNewTab(menu.kind, menu.id);
                        onClose();
                    }, children: openNewTabLabel })] }) }), document.body);
}
