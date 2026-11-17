import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createMockAuthAdapter } from '../../src/auth/adapters/mock'
import { configureAuth } from '../../src/auth/store'
import { installAuthGuard } from '../../src/auth/guard'
import { createBus } from '../../src/bus/bus'
import type { AuthAdapter } from '../../src/auth/types'

const stub = { template: '<i/>' }
function makeRouter(opts: { forbiddenPath?: string } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/auth/login', component: stub },
      { path: '/403', component: stub },
      { path: '/denied', component: stub },
      { path: '/open-perm', component: stub, meta: { permissions: ['x'] } },
      {
        path: '/area',
        component: stub,
        meta: { requiresAuth: true, permissions: ['area.read'] },
        children: [
          { path: '', component: stub },
          { path: 'edit', component: stub, meta: { permissions: ['area.write'] } },
          { path: 'str', component: stub, meta: { permissions: 'area.read' as unknown as string[] } },
        ],
      },
      { path: '/no-meta-parent', component: stub, children: [{ path: 'kid', component: stub, meta: { requiresAuth: true } }] },
    ],
  })
  installAuthGuard(router, { loginPath: '/auth/login', ...opts })
  return router
}
const withUser = (permissions: string[]) =>
  createMockAuthAdapter({ autoLogin: true, user: { id: '1', name: 'U', permissions } })

beforeEach(() => setActivePinia(createPinia()))

describe('auth guard gaps', () => {
  it('wildcard permission passes parent+child combined permissions', async () => {
    configureAuth(withUser(['*']), createBus())
    const r = makeRouter()
    await r.push('/area/edit')
    expect(r.currentRoute.value.path).toBe('/area/edit')
  })

  it('child permissions are ANDed with parent permissions (nested meta inheritance)', async () => {
    configureAuth(withUser(['area.read']), createBus())
    const r = makeRouter()
    await r.push('/area')
    expect(r.currentRoute.value.path).toBe('/area')
    await r.push('/area/edit')
    expect(r.currentRoute.value.path).toBe('/403')
  })

  it('having only the child permission is not enough: the parent permission is also required', async () => {
    configureAuth(withUser(['area.write']), createBus())
    const r = makeRouter()
    await r.push('/area/edit')
    expect(r.currentRoute.value.path).toBe('/403')
  })

  it('a string (non-array) permissions meta is honoured', async () => {
    configureAuth(withUser(['area.read']), createBus())
    const r = makeRouter()
    await r.push('/area/str')
    expect(r.currentRoute.value.path).toBe('/area/str')
  })

  it('requiresAuth on a child route alone protects it when the parent has none', async () => {
    configureAuth(createMockAuthAdapter(), createBus())
    const r = makeRouter()
    await r.push('/no-meta-parent/kid')
    expect(r.currentRoute.value.path).toBe('/auth/login')
    expect(r.currentRoute.value.query.redirect).toBe('/no-meta-parent/kid')
  })

  it('redirect preserves query string and hash of the original target', async () => {
    configureAuth(createMockAuthAdapter(), createBus())
    const r = makeRouter()
    await r.push('/area?tab=2&q=a%20b#sec')
    expect(r.currentRoute.value.path).toBe('/auth/login')
    expect(r.currentRoute.value.query.redirect).toBe('/area?tab=2&q=a%20b#sec')
  })

  it('custom forbiddenPath is used and is itself reachable without looping', async () => {
    configureAuth(withUser([]), createBus())
    const r = makeRouter({ forbiddenPath: '/denied' })
    await r.push('/area')
    expect(r.currentRoute.value.path).toBe('/denied')
  })

  it('permissions on a non-requiresAuth route send an anonymous user to the forbidden page (documented behaviour)', async () => {
    configureAuth(createMockAuthAdapter(), createBus())
    const r = makeRouter()
    await r.push('/open-perm')
    expect(r.currentRoute.value.path).toBe('/403')
  })

  it('an authenticated user can still open the login page', async () => {
    configureAuth(withUser([]), createBus())
    const r = makeRouter()
    await r.push('/auth/login')
    expect(r.currentRoute.value.path).toBe('/auth/login')
  })

  it('init rejection (fetchUser throws) is treated as anonymous: redirected to login, no crash', async () => {
    const boom: AuthAdapter = {
      ...createMockAuthAdapter(),
      withCredentials: true,
      fetchUser: () => Promise.reject(new Error('down')),
    }
    configureAuth(boom, createBus())
    const r = makeRouter()
    await r.push('/area')
    expect(r.currentRoute.value.path).toBe('/auth/login')
  })
})
