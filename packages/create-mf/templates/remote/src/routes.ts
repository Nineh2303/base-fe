import type { RouteRecordRaw } from 'vue-router'
import './style.css'
import SamplePage from './pages/SamplePage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'sample',
    component: SamplePage,
    // Public so the sample renders in any host. Set `requiresAuth: true` for protected pages.
    meta: { requiresAuth: false },
  },
]

export default routes
