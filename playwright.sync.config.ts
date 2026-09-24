import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'sync-responsive.pw.ts',
  outputDir: 'test-results/sync-responsive',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:1421',
    browserName: 'chromium',
    channel: 'chrome',
    serviceWorkers: 'block',
    timezoneId: 'America/Lima',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1421 --strictPort --configLoader runner',
    url: 'http://127.0.0.1:1421',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://forja-sync-fixture.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable-key',
    },
  },
});
