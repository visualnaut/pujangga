import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: 'src/web',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/web'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4173',
      '/ws': {
        target: 'ws://localhost:4173',
        ws: true,
      },
    },
  },
});
