import { useEffect, useState } from 'react';
import { waitForAppFonts } from '@shared/lib/waitForAppFonts';

export function useFontsReady(): boolean {
    const [ready, setReady] = useState(() => {
        if (typeof document === 'undefined' || !document.fonts)
            return true;
        return document.fonts.status === 'loaded';
    });
    useEffect(() => {
        let cancelled = false;
        void waitForAppFonts().then(() => {
            if (!cancelled)
                setReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return ready;
}
