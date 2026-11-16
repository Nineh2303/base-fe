import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createMockAuthAdapter } from '../../src/auth/adapters/mock'
import { configureAuth, useAuthStore } from '../../src/auth/store'
import { installAuthGuard } from '../../src/auth/guard'
import { createBus } from '../../src/bus/bus'
import type { AuthAdapter } from '../../src/auth/types'

const stub = { template: '<i/>' }
function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/auth/login', component: stub },
      { path: '/403', component: stub },
      { path: '/products', component: stub, meta: { requiresAuth: true } },
      { path: '/products/new', component: stub, meta: { requiresAuth: true, permissions: ['products.write'] } },
    ],
  })
  installAuthGuard(router, { loginPath: '/auth/login' })
  return router
}

beforeEach(() => setActivePinia(createPinia()))

describe('auth guard', () => {
  it('redirects anonymous users with redirect query', async () => {
    configureAuth(createMockAuthAdapter(), createBus())
    const r = makeRouter()
    await r.push('/products')
    expect(r.currentRoute.value.fullPath).toBe('/auth/login?redirect=/products')
  })

  it('does not loop when already going to loginPath', async () => {
    configureAuth(createMockAuthAdapter(), createBus())
    const r = makeRouter()
    await r.push('/auth/login')
    expect(r.currentRoute.value.path).toBe('/auth/login')
  })

  it('lets authenticated users through; public routes always pass', async () => {
    configureAuth(createMockAuthAdapter({ autoLogin: true }), createBus())
    const r = makeRouter()
    await r.push('/products')
    expect(r.currentRoute.value.path).toBe('/products')
    await r.push('/')
    expect(r.currentRoute.value.path).toBe('/')
  })

  it('redirects to /403 when permissions are missing', async () => {
    configureAuth(
      createMockAuthAdapter({ autoLogin: true, user: { id: '1', name: 'A', permissions: ['products.read'] } }),
      createBus(),
    )
    const r = makeRouter()
    await r.push('/products/new')
    expect(r.currentRoute.value.path).toBe('/403')
  })

  it('allows when permissions are present', async () => {
    configureAuth(
      createMockAuthAdapter({ autoLogin: true, user: { id: '1', name: 'A', permissions: ['products.write'] } }),
      createBus(),
    )
    const r = makeRouter()
    await r.push('/products/new')
    expect(r.currentRoute.value.path).toBe('/products/new')
  })

  it('waits for init() to finish while status is idle/loading', async () => {
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const base = createMockAuthAdapter({ autoLogin: true })
    const adapter: AuthAdapter = {
      ...base,
      fetchUser: async () => {
        await gate
        return base.fetchUser()
      },
    }
    configureAuth(adapter, createBus())
    const r = makeRouter()
    const nav = r.push('/products')
    await vi.waitFor(() => expect(useAuthStore().status).toBe('loading'))
    expect(r.currentRoute.value.path).not.toBe('/products')
    release()
    await nav
    expect(r.currentRoute.value.path).toBe('/products')
  })
})
