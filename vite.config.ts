import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client is a static PWA. The only server dependency is the Qwen proxy under
// /api/* — in dev we proxy it to the local Hono server; in prod the same origin
// serves both. No hardcoded hosts anywhere in client code: it always calls "/api".
const API_PORT = process.env.PORT || '8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
  },
});
