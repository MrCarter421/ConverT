import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // relative base so the built app works from any path — the domain root,
  // a local file server, or GitHub Pages' /ConverT/ subpath
  base: './',
  plugins: [react()],
  optimizeDeps: {
    // ffmpeg.wasm spawns its own module worker; pre-bundling breaks the worker URL resolution
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 40000,
  },
  server: {
    headers: {
      // harmless for the single-threaded core, ready for a future -mt core swap
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
