import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

/** Served on the main Hub domain: https://tickets.kostalegal.com/outlook-addin/ */
const BASE = '/outlook-addin/';

export default defineConfig(({ mode }) => ({
  base: BASE,
  plugins: mode === 'development' ? [mkcert()] : [],
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
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
