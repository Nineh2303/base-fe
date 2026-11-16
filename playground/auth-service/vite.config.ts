import { defineRemote } from '@nineh-fe-base/mf-vite'

export default defineRemote({
  name: 'auth',
  port: 5001,
  exposes: {
    './routes': './src/routes.ts',
    './setup': './src/setup.ts',
  },
})
