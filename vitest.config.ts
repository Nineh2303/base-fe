import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'playground/*', '!playground/e2e'],
  },
})
