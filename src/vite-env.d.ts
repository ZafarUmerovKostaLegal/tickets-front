
declare module '*.css?raw' {
    const content: string;
    export default content;
}

declare module '*.svg?raw' {
    const content: string;
    export default content;
}

declare module '*.ttf?url' {
    const src: string;
    export default src;
}

interface ImportMetaEnv {
    readonly TAURI_ENV_PLATFORM?: string;
    readonly TAURI_ENV_DEBUG?: string;
    readonly VITE_APP_TITLE?: string;
    readonly VITE_FAVICON_PATH?: string;
    readonly VITE_GOOGLE_FONTS_PRECONNECT?: string;
    readonly VITE_GOOGLE_FONTS_PRECONNECT_STATIC?: string;
    readonly VITE_GOOGLE_FONTS_STYLESHEET?: string;
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_USE_SESSION_COOKIE?: string;
    readonly VITE_PROXY_TARGET?: string;
    readonly VITE_CBU_PROXY_TARGET?: string;
    readonly VITE_ATTENDANCE_API_BASE?: string;
    readonly VITE_CBU_ORIGIN?: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
