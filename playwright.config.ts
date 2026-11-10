import { defineConfig, devices } from '@playwright/test'

// boots the in-memory API (seeded with the demo accounts) and the Vite client, then drives Chrome
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // locally the installed Chrome; CI installs Playwright's own Chromium
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:server:memory',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
