/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.performance.ts'],
    include: [
      'src/**/*.performance.test.{js,ts,jsx,tsx}',
      'src/**/__tests__/**/*.performance.{js,ts,jsx,tsx}'
    ],
    testTimeout: 120000, // Performance tests may take much longer
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/performance'
    }
  }
});