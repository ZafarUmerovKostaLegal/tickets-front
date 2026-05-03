import invoiceCoverLogoSvgUrl from '../../../../public/KostaLegal-logo-02-black.svg?url';

export type InvoiceCoverRasterizedLogo = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

/** URL из Vite-бандла (хэшированный путь после build). */
export function resolveInvoiceCoverLogoSvgHref(): string {
    if (typeof window === 'undefined')
        return invoiceCoverLogoSvgUrl;
    return new URL(invoiceCoverLogoSvgUrl, window.location.href).href;
}

/** Тот же файл из `public/`, когда fetch по бандлу не срабатывает (Tauri и т.п.). */
function resolvePublicFolderLogoHref(): string | null {
    if (typeof window === 'undefined')
        return null;
    const origin = window.location.origin;
    const base = import.meta.env.BASE_URL || '/';
    return new URL('KostaLegal-logo-02-black.svg', `${origin}${base.endsWith('/') ? base : `${base}/`}`).href;
}

async function fetchInvoiceCoverLogoSvgMarkup(): Promise<string | null> {
    const urls = [resolveInvoiceCoverLogoSvgHref(), resolvePublicFolderLogoHref()].filter(
        (u): u is string => typeof u === 'string',
    );
    // Уникальные URL (vite и public иногда совпадают)
    const seen = new Set<string>();
    const ordered = urls.filter((u) => !seen.has(u) && seen.add(u));

    for (const url of ordered) {
        try {
            const res = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
            if (!res.ok)
                continue;
            const text = await res.text();
            if (text.includes('<svg'))
                return text;
        }
        catch {
            /* пробуем следующий */
        }
    }
    return null;
}

/**
 * Если в SVG снова окажется полностраничный viewBox Illustrator, подменяем на обрезку под лого
 * (см. `public/KostaLegal-logo-02-black.svg`).
 */
function ensureTightLogoViewBoxIfFullPageCanvas(svgText: string): string {
    const fullPage =
        /<svg([^>]*)\bviewBox\s*=\s*["']\s*0\s+0\s+595\.?\d*\s+841\.?\d*\s*["']/i;
    if (!fullPage.test(svgText))
        return svgText;
    let s = svgText.replace(/\bviewBox\s*=\s*["'][^"']*["']/i, `viewBox="79 311 439 212"`);
    s = s.replace(/\s+style\s*=\s*"[^"]*enable-background[^"]*"/gi, '');
    if (!/\bpreserveAspectRatio\s*=/.test(s))
        s = s.replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"');
    if (!/\swidth\s*=\s*"[\d.]/.test(s))
        s = s.replace('<svg', '<svg width="439" height="212" ');
    return s;
}

/** SVG из `public`/бандла → PNG для pdf-lib / docx. */
export async function rasterizeInvoiceCoverLogoSvg(renderWidthPx: number): Promise<InvoiceCoverRasterizedLogo | null> {
    if (typeof document === 'undefined')
        return null;
    try {
        const markupRaw = await fetchInvoiceCoverLogoSvgMarkup();
        if (!markupRaw)
            return null;
        const svgText = ensureTightLogoViewBoxIfFullPageCanvas(markupRaw);

        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const objUrl = URL.createObjectURL(blob);
        try {
            const img = new Image();
            img.decoding = 'async';
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('invoice cover logo img'));
                img.src = objUrl;
            });
            const iw = Math.max(1, img.naturalWidth || img.width);
            const ih = Math.max(1, img.naturalHeight || img.height);
            const w = renderWidthPx;
            const h = Math.max(1, Math.round((ih / iw) * w));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return null;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
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
