import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@nineh-fe-base/ui': fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
  },
  test: {
    name: 'ui',
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
