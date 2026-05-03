import invoiceCoverLogoSvgUrl from '../../../../public/KostaLegal-logo-02-black.svg?url';

export type InvoiceCoverRasterizedLogo = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

/** URL для загрузки SVG того же актива, что в `public/`, но с путём от Vite (надёжно в dev/prod). */
export function resolveInvoiceCoverLogoSvgHref(): string {
    if (typeof window === 'undefined')
        return invoiceCoverLogoSvgUrl;
    return new URL(invoiceCoverLogoSvgUrl, window.location.href).href;
}

/** SVG из бандла / `public` → PNG для pdf-lib / docx (вектор напряму не везде поддерживается). */
export async function rasterizeInvoiceCoverLogoSvg(renderWidthPx: number): Promise<InvoiceCoverRasterizedLogo | null> {
    if (typeof document === 'undefined')
        return null;
    try {
        const href = resolveInvoiceCoverLogoSvgHref();
        const res = await fetch(href);
        if (!res.ok)
            return null;
        const svgText = await res.text();
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
