import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'mf-vite',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
