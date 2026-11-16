import type { RouteRecordRaw } from 'vue-router'
import SamplePage from './pages/SamplePage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'sample',
    component: SamplePage,
    meta: { requiresAuth: true },
  },
]

export default routes
