import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:1234';
const DEFAULT_CBU_PROXY_TARGET = 'https://cbu.uz';
function isCalendarStatusPath(url: string): boolean {
    return url.includes('/todos/calendar/status') || url.includes('calendar/status');
}
const DEV_PORT = 5173;
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const proxyTarget = (env.VITE_PROXY_TARGET || DEFAULT_PROXY_TARGET).replace(/\/$/, '');
    const cbuProxyTarget = (env.VITE_CBU_PROXY_TARGET || DEFAULT_CBU_PROXY_TARGET).replace(/\/$/, '');
    const tauriDevHost = typeof process.env.TAURI_DEV_HOST === 'string' && process.env.TAURI_DEV_HOST.trim()
        ? process.env.TAURI_DEV_HOST.trim()
        : undefined;
    const tauriPlatform = process.env.TAURI_ENV_PLATFORM;
    const viteBuildTarget =
        tauriPlatform === 'windows' || tauriPlatform === 'android'
            ? 'chrome105'
            : 'safari13';
    return {

        base: '/',
        clearScreen: false,
        envPrefix: ['VITE_', 'TAURI_ENV', 'TAURI_'],
        plugins: [react()],
        build: {
            target: viteBuildTarget,
            minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
            sourcemap: 'hidden',
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        const norm = id.replace(/\\/g, '/');
                        if (id.includes('node_modules/react-dom/'))
                            return 'react-vendor';
                        if (id.includes('node_modules/react/'))
                            return 'react-vendor';
                        if (id.includes('node_modules/react-router'))
                            return 'router';
                        if (id.includes('node_modules/recharts'))
                            return 'recharts';
                        if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/@pdf-lib/'))
                            return 'pdf-lib';
                        if (id.includes('node_modules/docx'))
                            return 'docx';
                        if (
                            norm.includes('/node_modules/buffer/')
                            || norm.includes('/node_modules/base64-js/')
                            || norm.includes('/node_modules/ieee754/')
                            || norm.includes('/node_modules/process/')
                            || norm.includes('/node_modules/events/')
                        )
                            return 'browser-polyfills';
                        if (
                            norm.includes('/node_modules/readable-stream/')
                            || norm.includes('/node_modules/inherits/')
                            || norm.includes('/node_modules/string_decoder/')
                            || norm.includes('/node_modules/safe-buffer/')
                            || norm.includes('/node_modules/core-util-is/')
                            || norm.includes('/node_modules/isarray/')
                            || id.includes('browser-external')
                        )
                            return 'excel-streams';
                        if (id.includes('node_modules/exceljs'))
                            return 'exceljs';
                        if (norm.includes('/src/shared/api/'))
                            return 'api-client';
                    },
                },
            },
        },
        define: {
            global: 'globalThis',
        },
        optimizeDeps: {
            include: ['buffer', 'core-js', 'regenerator-runtime', 'events', 'readable-stream', 'process'],

            exclude: ['exceljs', 'jszip'],

            force: process.env.VITE_FORCE_OPTIMIZE === '1',
        },
        resolve: {
            dedupe: ['buffer'],
            alias: {

                exceljs: path.resolve(__dirname, 'node_modules/exceljs/lib/exceljs.browser.js'),

                events: path.resolve(__dirname, 'node_modules/events/events.js'),

                stream: path.resolve(__dirname, 'node_modules/readable-stream/readable-browser.js'),

                jszip: path.resolve(__dirname, 'node_modules/jszip/lib/index.js'),
                '@app': path.resolve(__dirname, './src/app'),
                '@pages': path.resolve(__dirname, './src/pages'),
                '@widgets': path.resolve(__dirname, './src/widgets'),
                '@features': path.resolve(__dirname, './src/features'),
                '@entities': path.resolve(__dirname, './src/entities'),
                '@shared': path.resolve(__dirname, './src/shared'),
                buffer: 'buffer',
            },
        },
        preview: {
            headers: {
                'Content-Security-Policy':
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https: http://127.0.0.1:1234 http://localhost:1234; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss: ws:; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
            },
        },
        server: {
            port: DEV_PORT,
            strictPort: true,

            host: true,

            ...tauriDevHost
                ? { hmr: { host: tauriDevHost, port: DEV_PORT, clientPort: DEV_PORT, protocol: 'ws' } }
                : {},
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                    ws: true,
                    configure(proxy) {
                        proxy.on('error', (_err, req, res) => {
                            const sr = res as ServerResponse | undefined;
                            if (!sr || typeof sr.writeHead !== 'function' || sr.headersSent)
                                return;
                            const url = (req as IncomingMessage).url ?? '';
                            const detail = `API шлюза недоступен (прокси Vite). Запустите gateway на ${proxyTarget}.`;
                            const payload: Record<string, unknown> = { detail };
                            if (isCalendarStatusPath(url)) {
                                payload.connected = false;
                            }
                            sr.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                            sr.end(JSON.stringify(payload));
                        });
                    },
                },
                '/cbu-json': {
                    target: cbuProxyTarget,
                    changeOrigin: true,
                    secure: true,
                    rewrite: p => p.replace(/^\/cbu-json/, ''),
                },
            },
        },
    };
});
