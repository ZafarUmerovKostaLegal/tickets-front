import invoiceLetterheadFullSvgRaw from '../../../assets/brand/KostaLegal-logo-letterhead-full.svg?raw';

export type InvoiceCoverRasterizedLogo = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

export type RasterizeInvoiceLogoOptions = {
    /**
     * Word в тёмной теме может рисовать страницу тёмным; чёрный текст лого тогда не виден.
     * Белая подложка под PNG сохраняет читаемость в DOCX.
     */
    opaqueBackground?: boolean;
};

async function svgMarkupSource(): Promise<string | null> {
    const trimmed = invoiceLetterheadFullSvgRaw.trim();
    if (trimmed.includes('<svg'))
        return trimmed;

    /** Запас на случай пустого сырья в нестандартной сборке. */
    return null;
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

/** SVG из бандла → PNG для pdf-lib / docx (`?raw`: без fetch, чтобы лого попадало в экспорт всегда). */
export async function rasterizeInvoiceCoverLogoSvg(
    renderWidthPx: number,
    options?: RasterizeInvoiceLogoOptions,
): Promise<InvoiceCoverRasterizedLogo | null> {
    if (typeof document === 'undefined')
        return null;
    try {
        let markupRaw = await svgMarkupSource();
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
            const opaque = Boolean(options?.opaqueBackground);
            const ctx = canvas.getContext('2d', { alpha: !opaque });
            if (!ctx)
                return null;
            if (opaque) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
            }
            else {
                ctx.clearRect(0, 0, w, h);
            }
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
