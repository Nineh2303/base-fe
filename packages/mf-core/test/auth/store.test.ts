import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { jwtAdapter } from '../../src/auth/adapters/jwt'
import { createMockAuthAdapter } from '../../src/auth/adapters/mock'
import { configureAuth, useAuthStore } from '../../src/auth/store'
import { useAuth } from '../../src/auth/useAuth'
import { createBus } from '../../src/bus/bus'
import type { AuthAdapter } from '../../src/auth/types'

const user = { id: '1', name: 'A', permissions: ['a', 'b'] }
let mock: MockAdapter

beforeEach(() => {
  localStorage.clear()
  mock = new MockAdapter(axios)
  setActivePinia(createPinia())
})
afterEach(() => mock.restore())

describe('auth store', () => {
  it('throws a clear error before configureAuth', async () => {
    // fresh module state is not resettable; verify through a dynamic import
    vi.resetModules()
    const mod = await import('../../src/auth/store')
    const pinia = await import('pinia')
    pinia.setActivePinia(pinia.createPinia())
    expect(() => mod.useAuthStore().init()).toThrow(/\[mf-core\]/)
  })

  it('restores the session after reload via refresh then fetchUser', async () => {
    localStorage.setItem('mf-refresh-token', 'RT')
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'AT' })
    mock.onGet('/auth/me').reply((c) => [c.headers?.Authorization === 'Bearer AT' ? 200 : 401, user])
    configureAuth(jwtAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('authenticated')
    expect(s.user).toEqual(user)
  })

  it('is anonymous without a stored token', async () => {
    configureAuth(jwtAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('anonymous')
    expect(s.user).toBeNull()
  })

  it('init de-duplicates concurrent calls', async () => {
    const adapter = createMockAuthAdapter({ autoLogin: true })
    const spy = vi.spyOn(adapter, 'fetchUser')
    configureAuth(adapter, createBus())
    const s = useAuthStore()
    await Promise.all([s.init(), s.init()])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(s.status).toBe('authenticated')
  })

  it('login emits auth:login, logout emits auth:logout', async () => {
    const bus = createBus()
    const onLogin = vi.fn()
    const onLogout = vi.fn()
    bus.on('auth:login', onLogin)
    bus.on('auth:logout', onLogout)
    configureAuth(createMockAuthAdapter({ user }), bus)
    const s = useAuthStore()
    await s.login({})
    expect(onLogin).toHaveBeenCalledWith({ user })
    expect(s.isAuthenticated).toBe(true)
    await s.logout()
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(s.status).toBe('anonymous')
    expect(s.user).toBeNull()
  })

  it('hasPermission requires all permissions', async () => {
    configureAuth(createMockAuthAdapter({ user: { ...user, permissions: ['a'] } }), createBus())
    const s = useAuthStore()
    await s.login({})
    expect(s.hasPermission('a')).toBe(true)
    expect(s.hasPermission(['a', 'b'])).toBe(false)
    expect(s.permissions).toEqual(['a'])
  })

  it("hasPermission: '*' grants every permission", async () => {
    configureAuth(createMockAuthAdapter({ user: { ...user, permissions: ['*'] } }), createBus())
    const s = useAuthStore()
    await s.login({})
    expect(s.hasPermission(['a', 'b'])).toBe(true)
    expect(s.hasPermission('anything')).toBe(true)
  })

  it('concurrent refresh shares one in-flight promise', async () => {
    const adapter: AuthAdapter = { ...createMockAuthAdapter(), refresh: vi.fn(async () => true) }
    configureAuth(adapter, createBus())
    const s = useAuthStore()
    const [a, b] = await Promise.all([s.refresh(), s.refresh()])
    expect([a, b]).toEqual([true, true])
    expect(adapter.refresh).toHaveBeenCalledTimes(1)
  })

  it('useAuth exposes refs and bound actions', async () => {
    configureAuth(createMockAuthAdapter({ user }), createBus())
    const { user: u, isAuthenticated, login, hasPermission } = useAuth()
    expect(isAuthenticated.value).toBe(false)
    await login({})
    expect(u.value).toEqual(user)
    expect(isAuthenticated.value).toBe(true)
    expect(hasPermission(['a', 'b'])).toBe(true)
  })
})
