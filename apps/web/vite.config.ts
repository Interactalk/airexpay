import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiProxy = process.env.VITE_DEV_API_PROXY ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': { target: apiProxy, changeOrigin: true },
      '/api': { target: apiProxy, changeOrigin: true },
      '/health': { target: apiProxy, changeOrigin: true },
    },
  },
  preview: { port: 4173, strictPort: true },
});
