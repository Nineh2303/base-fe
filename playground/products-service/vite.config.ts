import { defineRemote } from '@nineh2303/mf-vite'

export default defineRemote({
  name: 'products',
  port: 5002,
  exposes: {
    './routes': './src/routes.ts',
  },
})
