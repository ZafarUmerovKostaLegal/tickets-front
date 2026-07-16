import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type ReportsRowContextMenuState = {
    x: number;
    y: number;
    kind: 'project' | 'client';
    id: string;
};

export function ReportsRowContextMenu({ menu, onClose, onOpen, onOpenNewTab, openLabel, openNewTabLabel, }: {
    menu: ReportsRowContextMenuState | null;
    onClose: () => void;
    onOpen: (kind: ReportsRowContextMenuState['kind'], id: string) => void;
    onOpenNewTab: (kind: ReportsRowContextMenuState['kind'], id: string) => void;
    openLabel: string;
    openNewTabLabel: string;
}) {
    useEffect(() => {
        if (!menu)
            return;
        const onKey = (e: KeyboardEvent) => {
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

    return createPortal(<div className="tt-reports__ctx-overlay" role="presentation" onClick={onClose} onContextMenu={(e) => {
        e.preventDefault();
        onClose();
    }}>
      <div className="tt-reports__ctx-menu" style={{ left: x, top: y }} role="menu" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="tt-reports__ctx-item" role="menuitem" onClick={() => {
            onOpen(menu.kind, menu.id);
            onClose();
        }}>
          {openLabel}
        </button>
        <button type="button" className="tt-reports__ctx-item" role="menuitem" onClick={() => {
            onOpenNewTab(menu.kind, menu.id);
            onClose();
        }}>
          {openNewTabLabel}
        </button>
      </div>
    </div>, document.body);
}
