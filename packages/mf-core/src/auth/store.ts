import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MfBus } from '../bus/bus'
import type { AuthAdapter, AuthStatus, AuthUser } from './types'

let currentAdapter: AuthAdapter | null = null
let currentBus: MfBus | null = null

export function configureAuth(adapter: AuthAdapter, bus: MfBus): void {
  currentAdapter = adapter
  currentBus = bus
}

function ctx(): { adapter: AuthAdapter; bus: MfBus } {
  if (!currentAdapter || !currentBus) {
    throw new Error('[mf-core] Auth is not configured. Call configureAuth(adapter, bus) (createMfApp does this) first.')
  }
  return { adapter: currentAdapter, bus: currentBus }
}

export const useAuthStore = defineStore('mf-core/auth', () => {
  const user = ref<AuthUser | null>(null)
  const status = ref<AuthStatus>('idle')
  const isAuthenticated = computed(() => status.value === 'authenticated' && user.value !== null)
  const permissions = computed(() => user.value?.permissions ?? [])

  let initPromise: Promise<void> | null = null
  let refreshPromise: Promise<boolean> | null = null

  function setAnonymous() {
    user.value = null
    status.value = 'anonymous'
  }

  function init(): Promise<void> {
    if (initPromise) return initPromise
    const { adapter } = ctx()
    status.value = 'loading'
    initPromise = (async () => {
      try {
        if (!adapter.withCredentials && !adapter.getAccessToken()) {
          const ok = await adapter.refresh()
          if (!ok) return setAnonymous()
        }
        const u = await adapter.fetchUser()
        if (u) {
          user.value = u
          status.value = 'authenticated'
        } else {
          setAnonymous()
        }
      } catch {
        setAnonymous()
      }
    })()
    return initPromise
  }

  async function login(credentials: Record<string, unknown>): Promise<AuthUser> {
    const { adapter, bus } = ctx()
    const u = await adapter.login(credentials)
    user.value = u
    status.value = 'authenticated'
    bus.emit('auth:login', { user: u })
    return u
  }

  async function logout(): Promise<void> {
    const { adapter, bus } = ctx()
    try {
      await adapter.logout()
    } finally {
      setAnonymous()
      bus.emit('auth:logout')
    }
  }

  function refresh(): Promise<boolean> {
    if (refreshPromise) return refreshPromise
    const { adapter } = ctx()
    refreshPromise = adapter.refresh().finally(() => {
      refreshPromise = null
    })
    return refreshPromise
  }

  function hasPermission(p: string | string[]): boolean {
    const needed = Array.isArray(p) ? p : [p]
    const have = permissions.value
    return needed.every((x) => have.includes(x))
  }

  return { user, status, isAuthenticated, permissions, init, login, logout, refresh, hasPermission }
})
