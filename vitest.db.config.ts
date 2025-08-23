/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.db.ts'],
    include: [
      'src/**/*.db.test.{js,ts,jsx,tsx}',
      'src/**/__tests__/**/*.db.{js,ts,jsx,tsx}'
    ],
    testTimeout: 60000, // Database tests may take longer
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/database'
    }
  }
});