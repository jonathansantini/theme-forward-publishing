import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'frontend',
    globals: true,
    environment: 'jsdom', // Using jsdom instead of happy-dom for better ES module compatibility
    setupFiles: ['./tests/setup.js'],
    include: ['**/__tests__/**/*.test.jsx', '**/*.test.jsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        '**/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
  server: {
    deps: {
      // Inline problematic dependencies to avoid ES module issues
      inline: ['isomorphic-dompurify', 'dompurify', 'html-encoding-sniffer'],
    },
  },
});
