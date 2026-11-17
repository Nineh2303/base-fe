import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ tsconfigPath: './tsconfig.json', entryRoot: 'src', include: ['src/**/*.ts', 'src/**/*.vue'] })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: {
      external: [
        /^vue($|\/)/,
        /^reka-ui($|\/)/,
        /^@nineh2303\/mf-core/,
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'lucide-vue-next',
        'vue-sonner',
      ],
    },
  },
})
