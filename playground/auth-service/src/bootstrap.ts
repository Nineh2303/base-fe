import { defineComponent, h } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { createMockAuthAdapter, createStandaloneRemote, useAuth } from '@nineh2303/mf-core'
import '@nineh2303/ui/styles/host.css'
import routes from './routes'
import setup from './setup'

// Minimal chrome for standalone dev: the remote itself has no page at `/auth`.
const StandaloneRoot = defineComponent({
  setup() {
    const { user } = useAuth()
    return () =>
      h('div', [
        h('p', user.value ? `Đã đăng nhập: ${user.value.name}` : h(RouterLink, { to: '/auth/login' }, () => 'Đăng nhập')),
        h(RouterView),
      ])
  },
})

// Standalone: no shell and no mock API; the mock adapter accepts any credentials.
const { mount } = await createStandaloneRemote({
  name: 'auth',
  root: StandaloneRoot,
  routes,
  routePrefix: '/auth',
  setup,
  auth: createMockAuthAdapter(),
  api: { baseURL: '/api' },
})

await mount('#app')
