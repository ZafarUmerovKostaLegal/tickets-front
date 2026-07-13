import { resolve } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';

const root = resolve(__dirname);

export default defineConfig({
    root,
    base: './',
    build: {
        outDir: resolve(root, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(root, 'src/background.ts'),
                content: resolve(root, 'src/content/app-bridge.ts'),
                popup: resolve(root, 'popup.html'),
            },
            output: {
                entryFileNames: (chunk) => {
                    if (chunk.name === 'content')
                        return 'content.js';
                    if (chunk.name === 'background')
                        return 'background.js';
                    return 'assets/[name]-[hash].js';
                },
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
    plugins: [
        {
            name: 'copy-manifest',
            closeBundle() {
                const dist = resolve(root, 'dist');
                mkdirSync(dist, { recursive: true });
                copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
            },
        },
    ],
});
