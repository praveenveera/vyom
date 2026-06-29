/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri dev server runs on a fixed port so HMR works across the native window
const host = process.env['TAURI_DEV_HOST'];

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: host ?? false,
    port: 5173,
    strictPort: true,
    ...(host !== undefined && {
      hmr: { protocol: 'ws', host, port: 5183 },
      watch: { ignored: ['**/src-tauri/**'] },
    }),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/api/**', 'src/hooks/**'],
    },
  },
});
