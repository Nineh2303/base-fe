import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'ui',
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
