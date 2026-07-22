import letterheadFullSvgRaw from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?raw';
import letterheadFullLogoUrl from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?url';

export type InvoiceLogoVariant = 'cover' | 'legal';

export type InvoiceCoverRasterizedLogo = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

/** Horizontal letterhead (cover page 1). */
export const COVER_LETTERHEAD_LOGO_ASPECT = 439 / 219;
/** Vertical mark (legal invoice page). */
export const LEGAL_VERT_LOGO_ASPECT = 224 / 377;

const VERT_LOGO_PUBLIC_PATH = 'vert-logo.svg';

function publicAssetUrl(fileName: string): string {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${prefix}${fileName}`;
}

function ensureTightFullLogoViewBoxIfIllustratorPage(svgText: string): string {
    const fullPage =
        /<svg([^>]*)\bviewBox\s*=\s*["']\s*0\s+0\s+595\.?\d*\s+841\.?\d*\s*["']/i;
    if (!fullPage.test(svgText))
        return svgText;
    let s = svgText.replace(/\bviewBox\s*=\s*["'][^"']*["']/i, `viewBox="79 311 439 219"`);
    s = s.replace(/\s+style\s*=\s*"[^"]*enable-background[^"]*"/gi, '');
    if (!/\bpreserveAspectRatio\s*=/.test(s))
        s = s.replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"');
    if (!/\swidth\s*=\s*"[\d.]/.test(s))
        s = s.replace('<svg', '<svg width="439" height="219" ');
    return s;
}

async function svgMarkupForVariant(variant: InvoiceLogoVariant): Promise<string | null> {
    if (variant === 'cover') {
        const trimmed = letterheadFullSvgRaw.trim();
        if (!trimmed.includes('<svg'))
            return null;
        return ensureTightFullLogoViewBoxIfIllustratorPage(trimmed);
    }
    try {
        const res = await fetch(publicAssetUrl(VERT_LOGO_PUBLIC_PATH));
        if (!res.ok)
            return null;
        const trimmed = (await res.text()).trim();
        return trimmed.includes('<svg') ? trimmed : null;
    }
    catch {
        return null;
    }
}

export async function rasterizeInvoiceLogoSvg(
    renderWidthPx: number,
    variant: InvoiceLogoVariant = 'cover',
): Promise<InvoiceCoverRasterizedLogo | null> {
    if (typeof document === 'undefined')
        return null;
    try {
        const svgText = await svgMarkupForVariant(variant);
        if (!svgText)
            return null;

        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const objUrl = URL.createObjectURL(blob);
        try {
            const img = new Image();
            img.decoding = 'async';
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error(`invoice ${variant} logo img`));
                img.src = objUrl;
            });
            const iw = Math.max(1, img.naturalWidth || img.width);
            const ih = Math.max(1, img.naturalHeight || img.height);
            const w = renderWidthPx;
            const h = Math.max(1, Math.round((ih / iw) * w));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx)
                return null;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const pngBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((b) => resolve(b), 'image/png'),
            );
            if (!pngBlob)
                return null;
            const buf = await pngBlob.arrayBuffer();
            return { png: new Uint8Array(buf), widthPx: w, heightPx: h };
        }
        finally {
            URL.revokeObjectURL(objUrl);
        }
    }
    catch {
        return null;
    }
}

/** @deprecated Prefer rasterizeInvoiceLogoSvg(width, 'cover'). */
export async function rasterizeInvoiceCoverLogoSvg(renderWidthPx: number): Promise<InvoiceCoverRasterizedLogo | null> {
    return rasterizeInvoiceLogoSvg(renderWidthPx, 'cover');
}

export function coverLetterheadLogoUrl(): string {
    return letterheadFullLogoUrl;
}

export function legalVertLogoPublicUrl(): string {
    return publicAssetUrl(VERT_LOGO_PUBLIC_PATH);
}

/** @deprecated Use coverLetterheadLogoUrl / legalVertLogoPublicUrl. */
export function invoiceLogoPublicUrl(): string {
    return legalVertLogoPublicUrl();
}

/** @deprecated Use COVER_LETTERHEAD_LOGO_ASPECT / LEGAL_VERT_LOGO_ASPECT. */
export const INVOICE_LOGO_ASPECT = LEGAL_VERT_LOGO_ASPECT;
