import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    // Plugin to replace environment variables in HTML
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace(
          '%VITE_SHOPIFY_API_KEY%',
          process.env.VITE_SHOPIFY_API_KEY || ''
        );
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    hmr: {
      protocol: 'ws',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
