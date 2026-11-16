import { createStandaloneRemote } from '@nineh-fe-base/mf-core'
import routes from './routes'

// Standalone mode (`npm run dev`): mock auth by default (auto-login).
// Pass `auth: jwtAdapter({ baseURL })` to run against a real backend — but standalone has no
// `/auth/login` page (that lives in the host/auth remote), so add a login route to `routes`
// (and point `loginPath` at it) before switching, or protected pages redirect to a 404.
const { mount } = await createStandaloneRemote({
  name: '%%name%%',
  routes,
  routePrefix: '/%%name%%',
  api: { baseURL: '/api' },
})

await mount('#app')
