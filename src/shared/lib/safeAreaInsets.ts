import { isTauriMobileBuild } from '@shared/config/tauriPlatform';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

function readEnvInset(side: Side): number {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side}, 0px);`;
    document.documentElement.appendChild(el);
    const value = parseFloat(getComputedStyle(el).getPropertyValue(`padding-${side}`)) || 0;
    el.remove();
    return value;
}

function getVisualViewportFallback(): Partial<Record<Side, number>> {
    const result: Partial<Record<Side, number>> = {};
    const vv = window.visualViewport;
    if (!vv)
        return result;

    if (vv.offsetTop > 0)
        result.top = Math.round(vv.offsetTop);

    const bottomGap = window.innerHeight - vv.height - vv.offsetTop;
    if (bottomGap > 0)
        result.bottom = Math.round(bottomGap);

    return result;
}

function shouldSyncInsets(): boolean {
    return isTauriMobileBuild() || window.matchMedia('(max-width: 768px)').matches;
}

function readJsInset(side: Side): number {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--app-safe-${side}-js`)
        .trim();
    return parseFloat(value) || 0;
}

function syncSafeAreaInsets(): void {
    const root = document.documentElement;
    const mobile = shouldSyncInsets();
    document.body.classList.toggle('app-shell--mobile', mobile);

    if (!mobile) {
        for (const side of SIDES)
            root.style.removeProperty(`--app-safe-${side}-js`);
        return;
    }

    const vvFallback = getVisualViewportFallback();

    for (const side of SIDES) {
        const env = readEnvInset(side);
        const native = readJsInset(side);
        const fallback = vvFallback[side] ?? 0;
        const value = Math.max(env, native, fallback);

        if (value > 0)
            root.style.setProperty(`--app-safe-${side}-js`, `${value}px`);
        else
            root.style.removeProperty(`--app-safe-${side}-js`);
    }
}

let initialized = false;

export function initSafeAreaInsets(): void {
    if (initialized || typeof window === 'undefined')
        return;
    initialized = true;

    const run = () => syncSafeAreaInsets();

    run();
    window.addEventListener('resize', run);
    window.addEventListener('app-safe-area-insets', run);
    window.visualViewport?.addEventListener('resize', run);
    window.visualViewport?.addEventListener('scroll', run);
    window.matchMedia('(max-width: 768px)').addEventListener('change', run);
}
