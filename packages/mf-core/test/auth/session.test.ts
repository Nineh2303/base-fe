import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { jwtAdapter } from '../../src/auth/adapters/jwt'
import { configureAuth, useAuthStore } from '../../src/auth/store'
import { installAuthGuard } from '../../src/auth/guard'
import { createBus } from '../../src/bus/bus'
import { createHttpClient } from '../../src/http/createHttpClient'

const user = { id: '1', name: 'A', permissions: ['a'] }
let mock: MockAdapter

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  mock = new MockAdapter(axios)
  setActivePinia(createPinia())
})
afterEach(() => mock.restore())

function stubServer() {
  mock.onPost('/auth/login').reply(200, { accessToken: 'AT1', refreshToken: 'RT1', user })
  mock.onPost('/auth/refresh').reply((c) => {
    const { refreshToken } = JSON.parse(c.data)
    if (refreshToken === 'RT1') return [200, { accessToken: 'AT2', refreshToken: 'RT2' }]
    if (refreshToken === 'RT2') return [200, { accessToken: 'AT3', refreshToken: 'RT3' }]
    return [401]
  })
  mock.onGet('/auth/me').reply((c) => [/^Bearer AT\d$/.test(String(c.headers?.Authorization)) ? 200 : 401, user])
  mock.onPost('/auth/logout').reply(200)
}

describe('session restore on reload', () => {
  it.each(['localStorage', 'sessionStorage'] as const)('restores with %s', async (kind) => {
    stubServer()
    configureAuth(jwtAdapter({ baseURL: 'http://x', refreshTokenStorage: kind }), createBus())
    await useAuthStore().login({ u: 1 })
    // "reload": new pinia + new adapter, same web storage
    setActivePinia(createPinia())
    configureAuth(jwtAdapter({ baseURL: 'http://x', refreshTokenStorage: kind }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('authenticated')
    expect(s.user).toEqual(user)
    const store = kind === 'localStorage' ? localStorage : sessionStorage
    expect(store.getItem('mf-refresh-token')).toBe('RT2')
  })

  it('memory storage: new adapter has no token -> anonymous', async () => {
    stubServer()
    configureAuth(jwtAdapter({ baseURL: 'http://x', refreshTokenStorage: 'memory' }), createBus())
    await useAuthStore().login({})
    setActivePinia(createPinia())
    configureAuth(jwtAdapter({ baseURL: 'http://x', refreshTokenStorage: 'memory' }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('anonymous')
    expect(localStorage.length).toBe(0)
  })

  it('concurrent init and concurrent refresh each hit the network once', async () => {
    stubServer()
    localStorage.setItem('mf-refresh-token', 'RT1')
    configureAuth(jwtAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await Promise.all([s.init(), s.init(), s.init()])
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(1)
    expect(mock.history.get.filter((r) => r.url === '/auth/me')).toHaveLength(1)
    const rs = await Promise.all([s.refresh(), s.refresh(), s.refresh()])
    expect(rs).toEqual([true, true, true])
    expect(mock.history.post.filter((r) => r.url === '/auth/refresh')).toHaveLength(2)
    expect(localStorage.getItem('mf-refresh-token')).toBe('RT3')
  })

  it.each(['network', '500'] as const)('logout with failing endpoint (%s) still clears and emits', async (mode) => {
    stubServer()
    mock.onPost('/auth/logout').reply(() => (mode === 'network' ? Promise.reject(new Error('Network Error')) : [500]))
    const bus = createBus()
    const events: string[] = []
    bus.on('auth:logout', () => events.push('out'))
    configureAuth(jwtAdapter({ baseURL: 'http://x' }), bus)
    const s = useAuthStore()
    await s.login({})
    await s.logout().catch(() => {})
    expect(s.status).toBe('anonymous')
    expect(s.user).toBeNull()
    expect(localStorage.getItem('mf-refresh-token')).toBeNull()
    expect(events).toEqual(['out'])
  })

  it('login 401 leaves anonymous (not loading) and rethrows', async () => {
    mock.onPost('/auth/login').reply(401)
    configureAuth(jwtAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await s.init() // no token -> anonymous
    await expect(s.login({})).rejects.toBeTruthy()
    expect(s.status).toBe('anonymous')
    expect(s.isAuthenticated).toBe(false)
    // login failure before init never leaves the store in 'loading'
    setActivePinia(createPinia())
    const s2 = useAuthStore()
    await expect(s2.login({})).rejects.toBeTruthy()
    expect(s2.status).not.toBe('loading')
    expect(s2.isAuthenticated).toBe(false)
  })
})

describe('guard edge cases', () => {
  function mk() {
    configureAuth(jwtAdapter({ baseURL: 'http://x' }), createBus())
    const Dummy = { render: () => null }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/auth/login', component: Dummy },
        { path: '/403', component: Dummy },
        {
          path: '/admin',
          component: Dummy,
          meta: { requiresAuth: true, permissions: ['admin'] },
          children: [{ path: 'x', component: Dummy }],
        },
      ],
    })
    installAuthGuard(router, { loginPath: '/auth/login' })
    return router
  }
  it('anonymous to loginPath does not loop; parent requiresAuth covers child', async () => {
    const router = mk()
    await router.push('/auth/login')
    expect(router.currentRoute.value.fullPath).toBe('/auth/login')
    await router.push('/admin/x')
    expect(router.currentRoute.value.fullPath).toBe('/auth/login?redirect=/admin/x')
  })
  it('parent permissions apply to child', async () => {
    const router = mk()
    const s = useAuthStore()
    s.user = user
    s.status = 'authenticated'
    await router.push('/admin/x')
    expect(router.currentRoute.value.path).toBe('/403')
  })
})

describe('http client integration', () => {
  function wire() {
    const adapter = jwtAdapter({ baseURL: 'http://x' })
    configureAuth(adapter, createBus())
    const s = useAuthStore()
    const http = createHttpClient({
      baseURL: 'http://api',
      auth: {
        getAccessToken: () => adapter.getAccessToken(),
        refresh: () => s.refresh(),
        onAuthFailure: () => s.logout(),
      },
    })
    return { s, http, api: new MockAdapter(http) }
  }
  it('401 -> refresh -> replay', async () => {
    stubServer()
    const { s, http, api } = wire()
    await s.login({})
    api.onGet('/data').reply((c) => (c.headers?.Authorization === 'Bearer AT2' ? [200, 'ok'] : [401]))
    expect((await http.get('/data')).data).toBe('ok')
    expect(s.status).toBe('authenticated')
    expect(localStorage.getItem('mf-refresh-token')).toBe('RT2')
  })
  it('failed refresh logs out', async () => {
    stubServer()
    const { s, http, api } = wire()
    await s.login({})
    mock.onPost('/auth/refresh').reply(401)
    api.onGet('/data').reply(401)
    await expect(http.get('/data')).rejects.toBeTruthy()
    expect(s.status).toBe('anonymous')
    expect(localStorage.getItem('mf-refresh-token')).toBeNull()
  })
})
