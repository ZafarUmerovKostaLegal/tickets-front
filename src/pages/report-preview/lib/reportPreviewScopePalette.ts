/** Soft row-highlight palette for Scope (Excel-like pastels). */
export const REPORT_PREVIEW_SCOPE_PALETTE: readonly string[] = [
    '#FFF2CC', // soft yellow (default)
    '#FFE599',
    '#FCE4D6', // peach
    '#F4CCCC', // rose
    '#EAD1DC', // pink
    '#D9EAD3', // mint
    '#B6D7A8', // green
    '#D0E0E3', // teal gray
    '#CFE2F3', // sky
    '#9FC5E8', // blue
    '#D9D2E9', // lavender
    '#B4A7D6', // purple
    '#D9D9D9', // gray
    '#B7B7B7',
    '#E6B8AF', // terracotta soft
    '#B9A979', // olive tan
] as const;

export const REPORT_PREVIEW_SCOPE_DEFAULT = REPORT_PREVIEW_SCOPE_PALETTE[0];

export function isScopePaletteColor(value: string | null | undefined): boolean {
    const raw = String(value ?? '').trim().toUpperCase();
    return REPORT_PREVIEW_SCOPE_PALETTE.some((c) => c === raw);
}
