import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const reuse = !process.env.CI

// One `npm run preview` (builds, then serves all three apps); the other two ports
// are listed as extra url checks so tests only start once every app is ready.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview',
    cwd: root,
    url: 'http://localhost:5000',
    reuseExistingServer: reuse,
    timeout: 180_000,
    stdout: 'pipe',
  },
})
