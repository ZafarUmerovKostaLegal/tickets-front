const LOGO_PUBLIC_PATH = 'vert-logo.svg';

export type InvoiceCoverRasterizedLogo = {
    png: Uint8Array;
    widthPx: number;
    heightPx: number;
};

/** Intrinsic aspect of public/vert-logo.svg (width / height). */
export const INVOICE_LOGO_ASPECT = 224 / 377;

function invoiceLogoUrl(): string {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${prefix}${LOGO_PUBLIC_PATH}`;
}

async function svgMarkupSource(): Promise<string | null> {
    try {
        const res = await fetch(invoiceLogoUrl());
        if (!res.ok)
            return null;
        const trimmed = (await res.text()).trim();
        return trimmed.includes('<svg') ? trimmed : null;
    }
    catch {
        return null;
    }
}

export async function rasterizeInvoiceCoverLogoSvg(renderWidthPx: number): Promise<InvoiceCoverRasterizedLogo | null> {
    if (typeof document === 'undefined')
        return null;
    try {
        const svgText = await svgMarkupSource();
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

export function invoiceLogoPublicUrl(): string {
    return invoiceLogoUrl();
}
