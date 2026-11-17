import type { RouteRecordRaw } from 'vue-router'
import Login from './pages/Login.vue'
import './style.css'

const routes: RouteRecordRaw[] = [{ path: 'login', name: 'login', component: Login }]

export default routes
