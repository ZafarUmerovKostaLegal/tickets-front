export type PortalDropdownBox = {
    top: number | undefined;
    bottom: number | undefined;
    left: number;
    width: number;
    maxH: number;
};

const MARGIN = 8;
const GAP = 4;
const MIN_MENU = 200;

export function readViewportBottomObstacle(triggerBottom: number): number {
    if (typeof window === 'undefined')
        return 0;
    let obstacle = window.innerHeight;
    if (typeof document === 'undefined')
        return obstacle;
    const docks = document.querySelectorAll('.tt-rp-mtable-dock');
    for (const el of docks) {
        const b = el.getBoundingClientRect();
        if (b.height < 8)
            continue;
        if (b.top >= triggerBottom - 4 && b.top < obstacle)
            obstacle = b.top;
    }
    return obstacle;
}

export function computePortalDropdownBox(
    trigger: { top: number; bottom: number; left: number; width: number },
    viewport: { width: number; height: number },
    opts?: { minWidth?: number; obstacleBottom?: number },
): PortalDropdownBox {
    const vh = viewport.height;
    const vw = viewport.width;
    const minW = opts?.minWidth ?? 300;
    const maxW = Math.max(0, vw - 16);
    const width = maxW > 0 ? Math.min(Math.max(trigger.width, minW), maxW) : Math.max(trigger.width, minW);
    let left = trigger.left;
    if (maxW > 0 && trigger.left + width > vw - 8)
        left = Math.max(8, vw - 8 - width);

    const obstacle = opts?.obstacleBottom ?? vh;
    const spaceBelow = obstacle - trigger.bottom - MARGIN;
    const spaceAbove = trigger.top - MARGIN;
    const openAbove = spaceBelow < MIN_MENU && spaceAbove > spaceBelow && spaceAbove >= 80;

    if (openAbove) {
        return {
            top: undefined,
            bottom: vh - trigger.top + GAP,
            left,
            width,
            maxH: Math.max(80, Math.min(spaceAbove - GAP, vh - 16)),
        };
    }
    const top = trigger.bottom + GAP;
    return {
        top,
        bottom: undefined,
        left,
        width,
        maxH: Math.max(80, Math.min(spaceBelow - GAP, vh - top - MARGIN)),
    };
}
