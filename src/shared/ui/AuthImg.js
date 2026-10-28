import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { fetchMediaBlob } from '@shared/api';
export function AuthImg({ mediaPath, fallback = null, alt = '', ...rest }) {
    const [blobUrl, setBlobUrl] = useState(null);
    useEffect(() => {
        if (!mediaPath) {
            setBlobUrl(null);
            return;
        }
        let revoke = null;
        let cancelled = false;
        fetchMediaBlob(mediaPath)
            .then((url) => {
            if (cancelled) {
                URL.revokeObjectURL(url);
                return;
            }
            revoke = url;
            setBlobUrl(url);
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
        return _jsx(_Fragment, { children: fallback });
    return _jsx("img", { src: blobUrl, alt: alt, ...rest });
}
