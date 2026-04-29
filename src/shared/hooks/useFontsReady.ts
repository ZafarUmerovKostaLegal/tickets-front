import { useEffect, useState } from 'react';
export function useFontsReady(): boolean {
    const [ready, setReady] = useState(() => {
        if (typeof document === 'undefined' || !(document as any).fonts)
            return true;
        return (document as any).fonts.status === 'loaded';
    });
    useEffect(() => {
        if (typeof document === 'undefined' || !(document as any).fonts)
            return;
        let cancelled = false;
        (document as any).fonts.ready
            .then(() => {
            if (!cancelled)
                setReady(true);
        })
            .catch(() => {
            if (!cancelled)
                setReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return ready;
}
