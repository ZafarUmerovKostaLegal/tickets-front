import { useEffect, useState } from 'react';
import {
    correspondenceErrorMessage,
    mintCorrespondenceDownloadQr,
} from '@entities/correspondence';

export type UseCorrespondenceDownloadQrResult = {
    url: string | null;
    loading: boolean;
    error: string | null;
};

/** Mint / refresh a signed public download URL for letter QR (HMAC + TTL on backend). */
export function useCorrespondenceDownloadQr(
    documentId: string | null | undefined,
    enabled = true,
): UseCorrespondenceDownloadQrResult {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const id = (documentId ?? '').trim();
        if (!enabled || !id) {
            setUrl(null);
            setError(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        void mintCorrespondenceDownloadQr(id)
            .then((res) => {
                if (cancelled)
                    return;
                setUrl(res.url);
            })
            .catch((err) => {
                if (cancelled)
                    return;
                setUrl(null);
                setError(correspondenceErrorMessage(err, 'Не удалось создать QR для скачивания'));
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => { cancelled = true; };
    }, [documentId, enabled]);

    return { url, loading, error };
}
