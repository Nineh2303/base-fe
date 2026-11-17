import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/**
 * Same specs as playwright.config.ts, but against the three apps in Vite DEV mode (`vite`, not build + preview).
 * Dev mode serves remote CSS through a different path (mf-vite's @scope transform at serve time), which the
 * preview-based run never touches. Always starts fresh servers: reusing a preview on the same ports would
 * silently test the wrong thing.
 */
const root = fileURLToPath(new URL('../..', import.meta.url))

const server = (app: string, port: number, path = '/mf-manifest.json', prefix = '') => ({
  command: `${prefix}npm run dev -w ${app}`,
  cwd: root,
  url: `http://localhost:${port}${path}`,
  reuseExistingServer: false,
  timeout: 180_000,
  stdout: 'pipe' as const,
})

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  // dev servers transform on demand: pages settle slower than the preview build
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium-dev', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    server('products-service', 5002, undefined, 'npm run build:framework && '),
    server('auth-service', 5001),
    server('shell', 5000, '/'),
  ],
})
