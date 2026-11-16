import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'create-mf',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
