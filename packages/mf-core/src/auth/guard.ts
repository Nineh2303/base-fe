import type { Router } from 'vue-router'
import { useAuthStore } from './store'

export function installAuthGuard(router: Router, opts: { loginPath: string; forbiddenPath?: string }): void {
  const forbiddenPath = opts.forbiddenPath ?? '/403'
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    if (auth.status === 'idle' || auth.status === 'loading') await auth.init()

    if (to.path === opts.loginPath || to.path === forbiddenPath) return true

    if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
      return { path: opts.loginPath, query: { redirect: to.fullPath } }
    }
    const required = to.matched.flatMap((r) => (r.meta.permissions as string[] | undefined) ?? [])
    if (required.length && !auth.hasPermission(required)) {
      return { path: forbiddenPath }
    }
    return true
  })
}
