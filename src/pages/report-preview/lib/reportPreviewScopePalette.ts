export const REPORT_PREVIEW_SCOPE_PALETTE: readonly string[] = [
    '#FFF2CC',
    '#FFE599',
    '#FCE4D6',
    '#F4CCCC',
    '#EAD1DC',
    '#D9EAD3',
    '#B6D7A8',
    '#D0E0E3',
    '#CFE2F3',
    '#9FC5E8',
    '#D9D2E9',
    '#B4A7D6',
    '#D9D9D9',
    '#B7B7B7',
    '#E6B8AF',
    '#B9A979',
] as const;

export const REPORT_PREVIEW_SCOPE_DEFAULT = REPORT_PREVIEW_SCOPE_PALETTE[0];

export function isScopePaletteColor(value: string | null | undefined): boolean {
    const raw = String(value ?? '').trim().toUpperCase();
    return REPORT_PREVIEW_SCOPE_PALETTE.some((c) => c === raw);
}
