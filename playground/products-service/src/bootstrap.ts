import { createStandaloneRemote } from '@nineh2303/mf-core'
import { startMocks } from '@playground/mocks'
import '@nineh2303/ui/styles/host.css'
import routes from './routes'

await startMocks()

// Standalone: default mock auth (auto-login, sends `Bearer mock-token`, accepted by the mock API).
const { mount } = await createStandaloneRemote({
  name: 'products',
  routes,
  routePrefix: '/products',
  api: { baseURL: '/api' },
})

await mount('#app')
