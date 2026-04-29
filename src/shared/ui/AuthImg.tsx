import { useState, useEffect, useRef, type ImgHTMLAttributes } from 'react';
import { fetchMediaBlob } from '@shared/api';
type AuthImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    mediaPath: string | null | undefined;
    fallback?: React.ReactNode;
};
export function AuthImg({ mediaPath, fallback = null, alt = '', ...rest }: AuthImgProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const prevPath = useRef<string | null>(null);
    useEffect(() => {
        if (!mediaPath) {
            setBlobUrl(null);
            return;
        }
        if (mediaPath === prevPath.current)
            return;
        let revoke: string | null = null;
        let cancelled = false;
        fetchMediaBlob(mediaPath)
            .then((url) => {
            if (cancelled) {
                URL.revokeObjectURL(url);
                return;
            }
            revoke = url;
            setBlobUrl(url);
            prevPath.current = mediaPath;
        })
            .catch(() => {
            if (!cancelled)
                setBlobUrl(null);
        });
        return () => {
            cancelled = true;
            if (revoke)
                URL.revokeObjectURL(revoke);
        };
    }, [mediaPath]);
    if (!blobUrl)
        return <>{fallback}</>;
    return <img src={blobUrl} alt={alt} {...rest}/>;
}
