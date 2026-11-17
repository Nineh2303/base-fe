import { createMfApp, jwtAdapter } from '@nineh2303/mf-core'
import { startMocks } from '@playground/mocks'
import '@nineh2303/ui/styles/host.css'
import Layout from './Layout.vue'
import Home from './pages/Home.vue'
import Forbidden from './pages/Forbidden.vue'
import NotFound from './pages/NotFound.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/403', name: 'forbidden', component: Forbidden },
  { path: '/404', name: 'not-found', component: NotFound },
]

await startMocks()

const { mount } = await createMfApp({
  root: Layout,
  routes,
  remotes: '/remotes.json',
  auth: jwtAdapter({ baseURL: '/api' }),
  api: { baseURL: '/api' },
})

await mount('#app')
