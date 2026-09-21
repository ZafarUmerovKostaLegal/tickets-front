import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export type CorrespondenceLetterQrProps = {
    url: string | null | undefined;
    sizePx?: number;
    label?: string;
};

const QR_OPTS = {
    errorCorrectionLevel: 'M' as const,
    /** Quiet zone must be ≥ 4 modules for phone cameras. */
    margin: 4,
    color: { dark: '#1e293b', light: '#ffffff' },
};

/** Letter QR — encodes a signed public download URL (sized for phone cameras). */
export function CorrespondenceLetterQr({
    url,
    sizePx = 128,
    label = 'Скачать документ',
}: CorrespondenceLetterQrProps) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);

    useEffect(() => {
        const target = (url ?? '').trim();
        if (!target) {
            setDataUrl(null);
            return;
        }
        let cancelled = false;
        void QRCode.toDataURL(target, {
            ...QR_OPTS,
            width: Math.max(256, sizePx * 2),
        })
            .then((out) => {
                if (!cancelled)
                    setDataUrl(out);
            })
            .catch(() => {
                if (!cancelled)
                    setDataUrl(null);
            });
        return () => { cancelled = true; };
    }, [url, sizePx]);

    if (!dataUrl)
        return null;

    return (
        <figure className="corr-letter__qr" aria-label={label}>
            <img
                className="corr-letter__qr-img"
                src={dataUrl}
                alt=""
                width={sizePx}
                height={sizePx}
                decoding="async"
            />
            <figcaption className="corr-letter__qr-caption">{label}</figcaption>
        </figure>
    );
}

/** Build PNG bytes for embedding into PDF / DOCX (same URL the on-screen QR uses). */
export async function buildCorrespondenceQrPngBytes(url: string, sizePx = 280): Promise<Uint8Array | null> {
    const target = url.trim();
    if (!target)
        return null;
    try {
        const dataUrl = await QRCode.toDataURL(target, {
            ...QR_OPTS,
            width: Math.max(280, sizePx),
        });
        const comma = dataUrl.indexOf(',');
        if (comma < 0)
            return null;
        const b64 = dataUrl.slice(comma + 1);
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1)
            out[i] = bin.charCodeAt(i);
        return out;
    }
    catch {
        return null;
    }
}
