import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // The hosted Firebase popup page is deployed independently and must never
  // share a Rollup graph (or chunks) with the Manifest V3 extension.
  publicDir: false,
  build: {
    outDir: 'dist-auth',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        authHost: resolve(import.meta.dirname, 'auth-host.html'),
      },
      output: {
        entryFileNames: 'authHost.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
