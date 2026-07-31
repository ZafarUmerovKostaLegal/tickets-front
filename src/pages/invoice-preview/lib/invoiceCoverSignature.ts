/** Partner signature asset for the invoice cover letter. */
export const COVER_SIGNATURE_PUBLIC_URL = '/signatures/AAA.svg';

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

/**
 * Load cover signature as PNG bytes (extracts embedded PNG from the SVG wrapper).
 * Falls back to canvas rasterization if the SVG has no embedded PNG.
 */
export async function loadCoverSignaturePng(): Promise<CoverSignaturePng | null> {
    if (typeof window === 'undefined')
        return null;
    try {
        const res = await fetch(COVER_SIGNATURE_PUBLIC_URL);
        if (!res.ok)
            return null;
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
        const url = URL.createObjectURL(blob);
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('signature image load failed'));
                el.src = url;
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
            URL.revokeObjectURL(url);
        }
    }
    catch {
        return null;
    }
}
