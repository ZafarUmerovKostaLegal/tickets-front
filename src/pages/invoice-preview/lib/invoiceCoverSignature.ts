/** Cover-letter partner signatures in `public/signatures` (file stem = initials). */

export type CoverSignatoryPartner = {
    /** Signature file stem / partner code used on the letter. */
    initials: string;
    displayName: string;
    fileName: string;
};

export const COVER_SIGNATORY_PARTNERS: readonly CoverSignatoryPartner[] = [
    { initials: 'AAA', displayName: 'Azizbek Akhmadjonov', fileName: 'AAA.svg' },
    { initials: 'MAD', displayName: 'Maxim Dogonkin', fileName: 'MAD.png' },
    { initials: 'NFH', displayName: 'Nail Hassanov', fileName: 'NFH.svg' },
    { initials: 'VBG', displayName: 'Vazgen Grigoryan', fileName: 'VBG.svg' },
] as const;

/** Aliases from invoice registry / short codes → signature file stem. */
const COVER_SIGNATURE_CODE_ALIASES: Record<string, string> = {
    AA: 'AAA',
    AAA: 'AAA',
    MD: 'MAD',
    MAD: 'MAD',
    NH: 'NFH',
    NF: 'NFH',
    NFH: 'NFH',
    VG: 'VBG',
    VGB: 'VBG',
    VBG: 'VBG',
};

export type CoverSignaturePng = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

const EMBEDDED_PNG_RE = /(?:xlink:)?href="data:image\/png;base64,([^"]+)"/i;

function decodeBase64Png(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function normalizeNameKey(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeCoverSignatureCode(raw: string | null | undefined): string | null {
    const t = (raw ?? '').trim().toUpperCase();
    if (!t)
        return null;
    const mapped = COVER_SIGNATURE_CODE_ALIASES[t] ?? COVER_SIGNATURE_CODE_ALIASES[t.replace(/\./g, '')];
    if (mapped)
        return mapped;
    return COVER_SIGNATORY_PARTNERS.some((p) => p.initials === t) ? t : null;
}

export function findCoverSignatoryPartnerByInitials(
    initials: string | null | undefined,
): CoverSignatoryPartner | null {
    const code = normalizeCoverSignatureCode(initials);
    if (!code)
        return null;
    return COVER_SIGNATORY_PARTNERS.find((p) => p.initials === code) ?? null;
}

export function findCoverSignatoryPartnerByName(
    name: string | null | undefined,
): CoverSignatoryPartner | null {
    const key = normalizeNameKey(name ?? '');
    if (!key)
        return null;
    const exact = COVER_SIGNATORY_PARTNERS.find((p) => normalizeNameKey(p.displayName) === key);
    if (exact)
        return exact;
    return COVER_SIGNATORY_PARTNERS.find((p) => {
        const parts = normalizeNameKey(p.displayName).split(' ').filter((x) => x.length > 1);
        return parts.length >= 2 && parts.every((part) => key.includes(part));
    }) ?? null;
}

/** Resolve partner from initials (preferred) or display name. */
export function resolveCoverSignatoryPartner(input: {
    initials?: string | null;
    name?: string | null;
}): CoverSignatoryPartner | null {
    return findCoverSignatoryPartnerByInitials(input.initials)
        ?? findCoverSignatoryPartnerByName(input.name);
}

export function coverSignaturePublicUrl(initialsOrPartner: string | CoverSignatoryPartner | null | undefined): string | null {
    const partner = typeof initialsOrPartner === 'string' || initialsOrPartner == null
        ? findCoverSignatoryPartnerByInitials(initialsOrPartner)
            ?? findCoverSignatoryPartnerByName(typeof initialsOrPartner === 'string' ? initialsOrPartner : null)
        : initialsOrPartner;
    if (!partner)
        return null;
    return `/signatures/${partner.fileName}`;
}

/** @deprecated Prefer coverSignaturePublicUrl / resolveCoverSignatoryPartner. */
export const COVER_SIGNATURE_PUBLIC_URL = coverSignaturePublicUrl('AAA') ?? '/signatures/AAA.svg';

async function loadPngFromUrl(url: string): Promise<CoverSignaturePng | null> {
    const res = await fetch(url);
    if (!res.ok)
        return null;
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('png') || url.toLowerCase().endsWith('.png')) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            const objUrl = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
            el.onload = () => {
                URL.revokeObjectURL(objUrl);
                resolve(el);
            };
            el.onerror = () => {
                URL.revokeObjectURL(objUrl);
                reject(new Error('png load failed'));
            };
            el.src = objUrl;
        });
        return {
            png: buf,
            widthPx: Math.max(1, img.naturalWidth || 341),
            heightPx: Math.max(1, img.naturalHeight || 171),
        };
    }

    const svgText = await res.text();
    const match = svgText.match(EMBEDDED_PNG_RE);
    if (match?.[1]) {
        const png = decodeBase64Png(match[1]);
        const vb = svgText.match(/viewBox="0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/i);
        const widthPx = vb ? Number(vb[1]) : 341;
        const heightPx = vb ? Number(vb[2]) : 171;
        return {
            png,
            widthPx: Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 341,
            heightPx: Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 171,
        };
    }

    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const objUrl = URL.createObjectURL(blob);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('signature image load failed'));
            el.src = objUrl;
        });
        const widthPx = Math.max(1, img.naturalWidth || 341);
        const heightPx = Math.max(1, img.naturalHeight || 171);
        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.drawImage(img, 0, 0, widthPx, heightPx);
        const dataUrl = canvas.toDataURL('image/png');
        const b64 = dataUrl.split(',')[1];
        if (!b64)
            return null;
        return { png: decodeBase64Png(b64), widthPx, heightPx };
    }
    finally {
        URL.revokeObjectURL(objUrl);
    }
}

/**
 * Load cover signature as PNG bytes for the given partner initials / name.
 * Extracts embedded PNG from SVG wrappers; supports `.png` files directly.
 */
export async function loadCoverSignaturePng(
    initialsOrName?: string | null,
): Promise<CoverSignaturePng | null> {
    if (typeof window === 'undefined')
        return null;
    const partner = resolveCoverSignatoryPartner({
        initials: initialsOrName,
        name: initialsOrName,
    });
    const url = coverSignaturePublicUrl(partner);
    if (!url)
        return null;
    try {
        return await loadPngFromUrl(url);
    }
    catch {
        return null;
    }
}
