import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [vue(), dts({ tsconfigPath: './tsconfig.json', entryRoot: 'src', include: ['src/**/*.ts', 'src/**/*.vue'] })],
  define: { __MF_CORE_VERSION__: JSON.stringify(pkg.version) },
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: {
      external: [/^vue($|\/)/, 'pinia', 'vue-router', 'vue-i18n', 'axios', 'mitt', /^@module-federation\/runtime/],
    },
  },
})
