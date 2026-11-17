import { createMfApp, jwtAdapter } from '@nineh2303/mf-core'
import '@nineh2303/ui/styles/host.css'
import Layout from './Layout.vue'
import Home from './pages/Home.vue'
import Forbidden from './pages/Forbidden.vue'
import Login from './pages/Login.vue'
import NotFound from './pages/NotFound.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  // Target of the auth guard redirect (loginPath default). Posts credentials to `${baseURL}/auth/login`.
  { path: '/auth/login', name: 'login', component: Login },
  { path: '/403', name: 'forbidden', component: Forbidden },
  { path: '/404', name: 'not-found', component: NotFound },
]

const { mount } = await createMfApp({
  root: Layout,
  routes,
  // Remotes are listed in public/remotes.json; add entries there to plug in micro-frontends.
  remotes: '/remotes.json',
  auth: jwtAdapter({ baseURL: '/api' }),
  api: { baseURL: '/api' },
})

await mount('#app')
