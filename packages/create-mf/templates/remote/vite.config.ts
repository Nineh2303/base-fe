import { defineRemote } from '@nineh2303/mf-vite'

export default defineRemote({
  name: '%%name%%',
  port: %%port%%,
  exposes: {
    './routes': './src/routes.ts',
  },
})
