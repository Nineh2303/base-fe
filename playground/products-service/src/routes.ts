import type { RouteRecordRaw } from 'vue-router'
import ProductList from './pages/ProductList.vue'
import './style.css'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'list',
    component: ProductList,
    meta: { requiresAuth: true, permissions: ['products.read'] },
  },
]

export default routes
