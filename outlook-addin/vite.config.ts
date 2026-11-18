import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

/** Served on the main Hub domain: https://tickets.kostalegal.com/outlook-addin/ */
const BASE = '/outlook-addin/';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: [react(), ...(mode === 'development' ? [mkcert()] : [])],
  define: {
    'import.meta.env.VITE_ADDIN_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 3001,
    strictPort: true,
    https: true,
  },
  preview: {
    port: 3001,
    strictPort: true,
    https: true,
  },
  build: {
    // Office desktop runs task panes in its own WebView (Safari 13+ on Mac, older Edge on some Windows builds).
    target: ['es2019', 'safari13', 'edge88'],
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
