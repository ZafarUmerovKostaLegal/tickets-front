import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [mkcert()],
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
});
