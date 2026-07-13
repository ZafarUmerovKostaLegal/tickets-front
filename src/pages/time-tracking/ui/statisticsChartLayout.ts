export function formatChartHours(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function niceAxisMax(maxValue: number): number {
    if (maxValue <= 0)
        return 10;
    const padded = maxValue * 1.22;
    const exp = Math.pow(10, Math.floor(Math.log10(padded)));
    const factor = padded / exp;
    const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
    return nice * exp;
}

export function labelReserveWidth(maxValue: number): number {
    const text = formatChartHours(maxValue);
    return Math.max(40, text.length * 7 + 16);
}

export function axisTicks(max: number): number[] {
    const step = max <= 10 ? 2 : max <= 30 ? 5 : max <= 100 ? 10 : max <= 200 ? 20 : 50;
    const ticks: number[] = [];
    for (let v = 0; v <= max + 0.001; v += step)
        ticks.push(Math.round(v * 100) / 100);
    return ticks;
}

export function yAxisWidthForNames(names: string[]): number {
    const longest = Math.max(...names.map((n) => n.length), 6);
    return Math.min(320, Math.max(92, Math.ceil(longest * 5.4) + 20));
}

export function truncateChartLabel(text: string, maxLen: number): string {
    if (text.length <= maxLen)
        return text;
    return `${text.slice(0, Math.max(1, maxLen - 1))}…`;
}

export function maxCharsForYAxisWidth(width: number): number {
    return Math.max(8, Math.floor((width - 20) / 5.4));
}
