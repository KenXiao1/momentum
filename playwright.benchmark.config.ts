import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './benchmarks',
  testMatch: '**/*.bench.ts',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'reports/quality/browser-benchmark-artifacts',
  use: { baseURL: 'http://127.0.0.1:4174', locale: 'en-US' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'npm run build -- --outDir reports/quality/benchmark-dist && npm run preview -- --outDir reports/quality/benchmark-dist --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
