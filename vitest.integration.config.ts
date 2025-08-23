/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.integration.ts'],
    include: [
      'src/**/*.integration.test.{js,ts,jsx,tsx}',
      'src/**/__tests__/**/*.integration.{js,ts,jsx,tsx}'
    ],
    testTimeout: 30000, // Integration tests may take longer
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/integration'
    }
  }
});