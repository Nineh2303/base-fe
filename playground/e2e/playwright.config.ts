import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const reuse = !process.env.CI

// One webServer entry per app so Playwright itself waits for every port before the first test.
// Entries start in order: the first also builds the framework packages the apps depend on.
const server = (app: string, port: number, path = '/mf-manifest.json', prefix = '') => ({
  command: `${prefix}npm run preview -w ${app}`,
  cwd: root,
  url: `http://localhost:${port}${path}`,
  reuseExistingServer: reuse,
  timeout: 180_000,
  stdout: 'pipe' as const,
})

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    server('products-service', 5002, undefined, 'npm run build:framework && '),
    server('auth-service', 5001),
    server('shell', 5000, '/'),
  ],
})
