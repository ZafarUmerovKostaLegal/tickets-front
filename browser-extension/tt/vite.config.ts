import { resolve } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';
import { build, defineConfig, type Plugin } from 'vite';

const root = resolve(__dirname);
const dist = resolve(root, 'dist');

/** Content scripts cannot use ES `import` unless manifest sets type:module; ship a single IIFE instead. */
function buildContentIifePlugin(): Plugin {
    return {
        name: 'build-content-iife',
        apply: 'build',
        async closeBundle() {
            await build({
                configFile: false,
                root,
                logLevel: 'warn',
                build: {
                    outDir: dist,
                    emptyOutDir: false,
                    lib: {
                        entry: resolve(root, 'src/content/app-bridge.ts'),
                        formats: ['iife'],
                        name: 'KlTtContentBridge',
                        fileName: () => 'content.js',
                    },
                    rollupOptions: {
                        output: {
                            inlineDynamicImports: true,
                            extend: true,
                        },
                    },
                },
            });
        },
    };
}

export default defineConfig({
    root,
    base: './',
    build: {
        outDir: dist,
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(root, 'src/background.ts'),
                popup: resolve(root, 'popup.html'),
            },
            output: {
                entryFileNames: (chunk) => {
                    if (chunk.name === 'background')
                        return 'background.js';
                    return 'assets/[name]-[hash].js';
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
    plugins: [
        buildContentIifePlugin(),
        {
            name: 'copy-manifest',
            closeBundle() {
                mkdirSync(dist, { recursive: true });
                copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
            },
        },
    ],
});
