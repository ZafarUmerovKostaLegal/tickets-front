export function buildVacColSegs(dayColumns) {
    const segs = [];
    let prevMonth = -1;
    for (const col of dayColumns) {
        if (prevMonth >= 0 && col.monthIndex !== prevMonth)
            segs.push({ type: 'monthSum', monthIndex: prevMonth });
        segs.push({
            type: 'day',
            dayColIndex: col.colIndex,
            monthIndex: col.monthIndex,
            day: col.day,
        });
        prevMonth = col.monthIndex;
    }
    if (prevMonth >= 0)
        segs.push({ type: 'monthSum', monthIndex: prevMonth });
    return segs;
}
export function remToPx(rem) {
    if (typeof document === 'undefined')
        return rem * 16;
    const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return rem * (Number.isFinite(root) && root > 0 ? root : 16);
}
export function readCssLenPx(el, varName, fallbackRem) {
    const raw = getComputedStyle(el).getPropertyValue(varName).trim();
    if (!raw)
        return remToPx(fallbackRem);
    if (raw.endsWith('rem'))
        return remToPx(Number.parseFloat(raw) || fallbackRem);
    if (raw.endsWith('px'))
        return Number.parseFloat(raw) || remToPx(fallbackRem);
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : remToPx(fallbackRem);
}
export const VAC_COL_OVERSCAN = 6;
export const VAC_ROW_OVERSCAN = 5;
