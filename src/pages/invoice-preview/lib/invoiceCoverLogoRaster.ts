import invoiceLetterheadFullSvgUrl from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?url';

export type InvoiceCoverRasterizedLogo = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

/** Полный SVG логотип (знак + KOSTA LEGAL) через Vite-бандл. */
export function resolveInvoiceCoverLogoSvgHref(): string {
    if (typeof window === 'undefined')
        return invoiceLetterheadFullSvgUrl;
    return new URL(invoiceLetterheadFullSvgUrl, window.location.href).href;
}

async function fetchInvoiceCoverLogoSvgMarkup(): Promise<string | null> {
    const url = resolveInvoiceCoverLogoSvgHref();
    try {
        const res = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
        if (!res.ok)
            return null;
        const text = await res.text();
        return text.includes('<svg') ? text : null;
    }
    catch {
        return null;
    }
}

/** Если снова экспорт на весь лист A4 из Illustrator — подменяем разумный viewBox полного лого. */
function ensureTightFullLogoViewBoxIfIllustratorPage(svgText: string): string {
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

/** SVG → PNG с альфой для pdf-lib / docx. Светлый фон у письма белый; альфа без лишней «плашки». */
export async function rasterizeInvoiceCoverLogoSvg(renderWidthPx: number): Promise<InvoiceCoverRasterizedLogo | null> {
    if (typeof document === 'undefined')
        return null;
    try {
        const markupRaw = await fetchInvoiceCoverLogoSvgMarkup();
        if (!markupRaw)
            return null;
        const svgText = ensureTightFullLogoViewBoxIfIllustratorPage(markupRaw);

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
