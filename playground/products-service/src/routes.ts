import type { RouteRecordRaw } from 'vue-router'
import ProductList from './pages/ProductList.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'list',
    component: ProductList,
    meta: { requiresAuth: true, permissions: ['products.read'] },
  },
]

export default routes
