import type { RouteRecordRaw } from 'vue-router'
import Login from './pages/Login.vue'

const routes: RouteRecordRaw[] = [{ path: 'login', name: 'login', component: Login }]

export default routes
