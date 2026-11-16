import { storeToRefs } from 'pinia'
import type { ComputedRef, Ref } from 'vue'
import { useAuthStore } from './store'
import type { AuthStatus, AuthUser } from './types'

export interface AuthApi {
  user: Ref<AuthUser | null>
  status: Ref<AuthStatus>
  isAuthenticated: ComputedRef<boolean>
  login(credentials: Record<string, unknown>): Promise<AuthUser>
  logout(): Promise<void>
  refresh(): Promise<boolean>
  hasPermission(p: string | string[]): boolean
  init(): Promise<void>
}

export function useAuth(): AuthApi {
  const store = useAuthStore()
  const { user, status, isAuthenticated } = storeToRefs(store)
  return {
    user: user as Ref<AuthUser | null>,
    status,
    isAuthenticated,
    login: store.login,
    logout: store.logout,
    refresh: store.refresh,
    hasPermission: store.hasPermission,
    init: store.init,
  }
}
