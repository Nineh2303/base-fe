import { createStandaloneRemote } from '@nineh-fe-base/mf-core'
import routes from './routes'

// Standalone mode (`npm run dev`): mock auth by default (auto-login).
// Pass `auth: jwtAdapter({ baseURL })` to run against a real backend.
const { mount } = await createStandaloneRemote({
  name: '%%name%%',
  routes,
  routePrefix: '/%%name%%',
  api: { baseURL: '/api' },
})

await mount('#app')
