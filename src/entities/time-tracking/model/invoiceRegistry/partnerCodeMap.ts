/** Canonical partner code renames for invoice registry (display + seed/overrides). */
const PARTNER_CODE_MAP: Record<string, string> = {
    AA: 'AAA',
    VG: 'VGB',
    NH: 'NFH',
    MD: 'MAD',
    SHYU: 'SHMYU',
    ShYu: 'SHMYU',
    shyu: 'SHMYU',
};

export function mapInvoiceRegistryPartnerCode(raw: string): string {
    const t = raw.trim();
    if (!t)
        return t;
    if (PARTNER_CODE_MAP[t])
        return PARTNER_CODE_MAP[t]!;
    const up = t.toUpperCase();
    if (PARTNER_CODE_MAP[up])
        return PARTNER_CODE_MAP[up]!;
    return t;
}

/** Remap partner initials in advanceFee lines like `NH: 1 000` → `NFH: 1 000`. */
export function mapInvoiceRegistryAdvanceFee(text: string): string {
    if (!text.trim())
        return text;
    return text.split('\n').map((line) => {
        const m = line.match(/^(\s*)([A-Za-zА-Яа-яЁё]{2,5})(\s*:\s*)([\s\S]*)$/);
        if (!m)
            return line;
        const code = mapInvoiceRegistryPartnerCode(m[2] ?? '');
        return `${m[1]}${code}${m[3]}${m[4]}`;
    }).join('\n');
}

export function applyInvoiceRegistryPartnerCodeFixes<T extends Record<string, string>>(row: T): T {
    let changed = false;
    const next = { ...row };
    if (typeof next.partner === 'string') {
        const p = mapInvoiceRegistryPartnerCode(next.partner);
        if (p !== next.partner) {
            next.partner = p;
            changed = true;
        }
    }
    if (typeof next.advanceFee === 'string' && next.advanceFee) {
        const fee = mapInvoiceRegistryAdvanceFee(next.advanceFee);
        if (fee !== next.advanceFee) {
            next.advanceFee = fee;
            changed = true;
        }
    }
    return changed ? next : row;
}
