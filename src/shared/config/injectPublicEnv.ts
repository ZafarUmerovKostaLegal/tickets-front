const DEFAULT_APP_TITLE = 'Kosta Legal — Tickets';
const DEFAULT_FAVICON = '/vite.svg';
const DEFAULT_FONT_PRECONNECT = 'https://fonts.googleapis.com';
const DEFAULT_FONT_PRECONNECT_STATIC = 'https://fonts.gstatic.com';
const DEFAULT_FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
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
    const title = import.meta.env.VITE_APP_TITLE?.trim() || DEFAULT_APP_TITLE;
    document.title = title;
    const favicon = import.meta.env.VITE_FAVICON_PATH?.trim() || DEFAULT_FAVICON;
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
        (() => {
            const el = document.createElement('link');
            el.rel = 'icon';
            document.head.appendChild(el);
            return el;
        })();
    iconLink.type = 'image/svg+xml';
    iconLink.href = favicon;
    appendPreconnect(import.meta.env.VITE_GOOGLE_FONTS_PRECONNECT?.trim() || DEFAULT_FONT_PRECONNECT);
    appendPreconnect(import.meta.env.VITE_GOOGLE_FONTS_PRECONNECT_STATIC?.trim() || DEFAULT_FONT_PRECONNECT_STATIC, 'anonymous');
    appendStylesheet(import.meta.env.VITE_GOOGLE_FONTS_STYLESHEET?.trim() || DEFAULT_FONT_STYLESHEET);
}
