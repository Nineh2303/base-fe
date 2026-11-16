import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [vue()],
  define: { __MF_CORE_VERSION__: JSON.stringify(pkg.version) },
  test: {
    name: 'mf-core',
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
