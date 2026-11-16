import { defineRemote } from '@nineh-fe-base/mf-vite'

export default defineRemote({
  name: 'products',
  port: 5002,
  exposes: {
    './routes': './src/routes.ts',
  },
})
