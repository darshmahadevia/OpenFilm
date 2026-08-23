import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:4187',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4187 --strictPort',
        reuseExistingServer: false,
        timeout: 120_000,
        url: 'http://127.0.0.1:4187',
      },
  workers: 1,
});
