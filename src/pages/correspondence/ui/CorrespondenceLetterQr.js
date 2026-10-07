import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
const QR_OPTS = {
    errorCorrectionLevel: 'M',
    /** Quiet zone must be ≥ 4 modules for phone cameras. */
    margin: 4,
    color: { dark: '#1e293b', light: '#ffffff' },
};
/** Letter QR — encodes a signed public download URL (sized for phone cameras). */
export function CorrespondenceLetterQr({ url, sizePx = 128, label = 'Скачать документ', }) {
    const [dataUrl, setDataUrl] = useState(null);
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
    return (_jsxs("figure", { className: "corr-letter__qr", "aria-label": label, children: [_jsx("img", { className: "corr-letter__qr-img", src: dataUrl, alt: "", width: sizePx, height: sizePx, decoding: "async" }), _jsx("figcaption", { className: "corr-letter__qr-caption", children: label })] }));
}
/** Build PNG bytes for embedding into PDF / DOCX (same URL the on-screen QR uses). */
export async function buildCorrespondenceQrPngBytes(url, sizePx = 280) {
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
