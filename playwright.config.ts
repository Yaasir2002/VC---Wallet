import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  timeout: 60_000,
  workers: 1,
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  use: {
    baseURL: process.env.WALLET_TEST_URL || 'http://localhost:8081',
    headless: true,
    launchOptions: process.env.WALLET_BROWSER_PATH
      ? { executablePath: process.env.WALLET_BROWSER_PATH }
      : undefined,
  },
});
