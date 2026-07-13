import { APP_LOGO_PATH, APP_WINDOW_TITLE } from './appBranding';
import { isTauriMobileBuild } from './tauriPlatform';

const DEFAULT_FAVICON = APP_LOGO_PATH;
const LEGACY_FAVICON = '/vite.svg';
const DEFAULT_FONT_PRECONNECT = 'https://fonts.googleapis.com';
const DEFAULT_FONT_PRECONNECT_STATIC = 'https://fonts.gstatic.com';
const DEFAULT_FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap';
function appendPreconnect(href: string, crossOrigin?: 'anonymous') {
    const t = href.trim();
    if (!t)
        return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = t;
    if (crossOrigin)
        link.crossOrigin = crossOrigin;
    document.head.appendChild(link);
}
function appendStylesheet(href: string) {
    const t = href.trim();
    if (!t)
        return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = t;
    document.head.appendChild(link);
}
export function injectPublicEnv(): void {
    const title = import.meta.env.VITE_APP_TITLE?.trim() || APP_WINDOW_TITLE;
    document.title = title;
    const envFavicon = import.meta.env.VITE_FAVICON_PATH?.trim();
    const favicon =
        !envFavicon || envFavicon === LEGACY_FAVICON ? DEFAULT_FAVICON : envFavicon;
    const setIconLink = (rel: string, extra?: Partial<HTMLLinkElement>) => {
        const selector = rel === 'icon' ? 'link[rel="icon"]' : `link[rel="${rel}"]`;
        const link =
            document.querySelector<HTMLLinkElement>(selector) ??
            (() => {
                const el = document.createElement('link');
                el.rel = rel;
                document.head.appendChild(el);
                return el;
            })();
        link.href = favicon;
        if (extra)
            Object.assign(link, extra);
    };
    setIconLink('icon', { type: 'image/svg+xml' });
    setIconLink('mask-icon');
    setIconLink('apple-touch-icon');
    if (!isTauriMobileBuild()) {
        appendPreconnect(import.meta.env.VITE_GOOGLE_FONTS_PRECONNECT?.trim() || DEFAULT_FONT_PRECONNECT);
        appendPreconnect(import.meta.env.VITE_GOOGLE_FONTS_PRECONNECT_STATIC?.trim() || DEFAULT_FONT_PRECONNECT_STATIC, 'anonymous');
        appendStylesheet(import.meta.env.VITE_GOOGLE_FONTS_STYLESHEET?.trim() || DEFAULT_FONT_STYLESHEET);
    }
}
