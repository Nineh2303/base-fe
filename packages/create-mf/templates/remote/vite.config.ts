import { defineRemote } from '@nineh-fe-base/mf-vite'

export default defineRemote({
  name: '{{name}}',
  port: {{port}},
  exposes: {
    './routes': './src/routes.ts',
  },
})
