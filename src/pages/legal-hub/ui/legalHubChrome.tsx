import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

const SetChromeContext = createContext<(style: CSSProperties | undefined) => void>(() => {});
const ChromeStyleContext = createContext<CSSProperties | undefined>(undefined);

function applyRootTheme(style: CSSProperties | undefined): () => void {
    const root = document.documentElement;
    if (!style)
        return () => {};
    const keys = Object.keys(style).filter((key) => key.startsWith('--'));
    const previous = new Map(keys.map((key) => [key, root.style.getPropertyValue(key)]));
    for (const key of keys) {
        const value = style[key as keyof CSSProperties];
        if (typeof value === 'string')
            root.style.setProperty(key, value);
    }
    const previousScheme = root.style.colorScheme;
    if (style.colorScheme)
        root.style.colorScheme = String(style.colorScheme);
    return () => {
        for (const [key, value] of previous) {
            if (value)
                root.style.setProperty(key, value);
            else
                root.style.removeProperty(key);
        }
        root.style.colorScheme = previousScheme;
    };
}

export function LegalHubChromeProvider({ children }: { children: ReactNode }) {
    const [style, setStyle] = useState<CSSProperties | undefined>(undefined);
    const setChrome = useMemo(() => (next: CSSProperties | undefined) => setStyle(next), []);
    useEffect(() => applyRootTheme(style), [style]);
    return (
        <SetChromeContext.Provider value={setChrome}>
            <ChromeStyleContext.Provider value={style}>
                {children}
            </ChromeStyleContext.Provider>
        </SetChromeContext.Provider>
    );
}

export function useLegalHubChromeStyle(): CSSProperties | undefined {
    return useContext(ChromeStyleContext);
}

export function useSetLegalHubChrome(): (style: CSSProperties | undefined) => void {
    return useContext(SetChromeContext);
}
