import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { defineStore } from 'pinia'
import MockAdapter from 'axios-mock-adapter'
import {
  createMfApp,
  createStandaloneRemote,
  useMfLayout,
  useAuth,
  useMfContext,
  createMockAuthAdapter,
  cookieAdapter,
  CORE_VERSION,
} from '../src/index'
import type { AuthAdapter, FederationRuntime, MfAppHandle } from '../src/index'

const Page = (label: string) => defineComponent({ name: label, render: () => h('div', { class: 'page' }, label) })

const Root = defineComponent({
  name: 'Root',
  setup() {
    const layout = useMfLayout()
    return () => h('div', { class: 'root' }, [layout.value ? h('nav', { class: 'chrome' }, 'nav') : null, h(RouterView)])
  },
})

function fakeRuntime(mods: Record<string, unknown>, delayMs = 0): FederationRuntime {
  return {
    register() {},
    async load<T>(id: string): Promise<T> {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      else await Promise.resolve()
      if (!(id in mods)) throw new Error(`Module ./${id.split('/').slice(1).join('/')} does not exist in container.`)
      const v = mods[id]
      if (v instanceof Error) throw v
      return v as T
    },
  }
}

function historyAt(path: string) {
  const history = createMemoryHistory()
  history.replace(path)
  return history
}

const handles: MfAppHandle[] = []
function el() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}
afterEach(() => {
  for (const hd of handles.splice(0)) {
    try {
      hd.app.unmount()
    } catch {
      // not mounted
    }
  }
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function track<T extends MfAppHandle>(h: T): T {
  handles.push(h)
  return h
}

const productsManifest = {
  remotes: [{ name: 'products', entry: 'http://localhost/products/remoteEntry.js', routePrefix: '/products' }],
}

describe('createMfApp', () => {
  it('deep link to a remote route resolves after slow remote load (not 404)', async () => {
    const runtime = fakeRuntime(
      {
        'products/mf-meta': { name: 'products', coreVersion: CORE_VERSION },
        'products/routes': [{ path: 'list', name: 'list', component: Page('products-list') }],
      },
      50,
    )
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', name: 'home', component: Page('home') }],
        remotes: productsManifest,
        auth: createMockAuthAdapter({ autoLogin: true }),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/list'),
        runtime,
      }),
    )
    const target = el()
    await handle.mount(target)
    const route = handle.ctx.router.currentRoute.value
    expect(route.path).toBe('/products/list')
    expect(route.name).toBe('products/list')
    expect(target.textContent).toContain('products-list')
    expect(handle.ctx.remotes.value[0]?.status).toBe('ready')
  })

  it('manifest failure: mount still succeeds, root renders, bus gets an error notify', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', name: 'home', component: Page('home') }],
        remotes: () => Promise.reject(new Error('boom')),
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
        runtime: fakeRuntime({}),
      }),
    )
    const notes: { type: string; message: string }[] = []
    handle.ctx.bus.on('notify', (n) => notes.push(n))
    const target = el()
    await handle.mount(target)
    expect(target.querySelector('.root')).not.toBeNull()
    expect(target.textContent).toContain('home')
    expect(notes).toHaveLength(1)
    expect(notes[0]!.type).toBe('error')
    expect(notes[0]!.message).toContain('boom')
    expect(errSpy.mock.calls.some((c) => String(c[0]).startsWith('[mf-core]'))).toBe(true)
  })

  it('ctx.http sends the access token after login', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
      }),
    )
    await handle.mount(el())
    const mock = new MockAdapter(handle.ctx.http)
    mock.onGet('/items').reply(200, [])
    await handle.ctx.http.get('/items')
    expect(mock.history.get[0]!.headers?.Authorization).toBeUndefined()
    await handle.ctx.auth.login({})
    expect(handle.ctx.auth.isAuthenticated.value).toBe(true)
    await handle.ctx.http.get('/items')
    expect(mock.history.get[1]!.headers?.Authorization).toBe('Bearer mock-token')
    expect(handle.ctx.http.defaults.baseURL).toBe('http://api')
  })

  it('ctx.http: token only for api origin + api.trustedOrigins, never a foreign origin', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        auth: createMockAuthAdapter({ autoLogin: true }),
        api: { baseURL: 'http://api', trustedOrigins: ['http://files'] },
        history: historyAt('/'),
      }),
    )
    await handle.mount(el())
    expect(handle.ctx.auth.isAuthenticated.value).toBe(true)
    const mock = new MockAdapter(handle.ctx.http)
    mock.onAny().reply(200, [])
    await handle.ctx.http.get('/items')
    await handle.ctx.http.get('http://files/x')
    await handle.ctx.http.get('http://third-party/x')
    expect(mock.history.get.map((c) => c.headers?.Authorization ?? null)).toEqual([
      'Bearer mock-token',
      'Bearer mock-token',
      null,
    ])
  })

  it('cookie adapter: ctx.http requests are sent withCredentials', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        auth: cookieAdapter({ baseURL: 'http://api' }),
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
      }),
    )
    const mock = new MockAdapter(handle.ctx.http)
    mock.onGet('/items').reply(200, [])
    await handle.ctx.http.get('/items')
    expect(mock.history.get[0]!.withCredentials).toBe(true)
  })

  it('auth failure on 401: logs out and navigates to loginPath with redirect', async () => {
    const user = { id: '1', name: 'A', permissions: [] }
    const adapter: AuthAdapter = {
      login: async () => user,
      logout: async () => {},
      refresh: async () => false,
      fetchUser: async () => user,
      getAccessToken: () => 't1',
    }
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [
          { path: '/', component: Page('home') },
          { path: '/page', component: Page('page') },
          { path: '/login', component: Page('login') },
        ],
        auth: adapter,
        api: { baseURL: 'http://api' },
        loginPath: '/login',
        history: historyAt('/page'),
      }),
    )
    await handle.mount(el())
    expect(handle.ctx.auth.isAuthenticated.value).toBe(true)
    const mock = new MockAdapter(handle.ctx.http)
    mock.onGet('/secret').reply(401)
    await expect(handle.ctx.http.get('/secret')).rejects.toBeTruthy()
    await vi.waitFor(() => expect(handle.ctx.router.currentRoute.value.path).toBe('/login'))
    expect(handle.ctx.router.currentRoute.value.query.redirect).toBe('/page')
    expect(handle.ctx.auth.isAuthenticated.value).toBe(false)
  })

  it('only one Pinia: a store used in a remote component lives in ctx.pinia; ctx is injected', async () => {
    const useCart = defineStore('products/cart', { state: () => ({ items: 0 }) })
    let injectedPinia: unknown
    let ctxPinia: unknown
    const RemotePage = defineComponent({
      setup() {
        const cart = useCart()
        injectedPinia = cart._p
        ctxPinia = useMfContext().pinia
        return () => h('div', 'cart')
      },
    })
    const setup = vi.fn()
    const handle = track(
      await createMfApp({
        root: Root,
        remotes: productsManifest,
        auth: createMockAuthAdapter({ autoLogin: true }),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/cart'),
        runtime: fakeRuntime({
          'products/mf-meta': { name: 'products', coreVersion: CORE_VERSION },
          'products/routes': [{ path: 'cart', name: 'cart', component: RemotePage }],
          'products/setup': setup,
        }),
      }),
    )
    await handle.mount(el())
    expect(injectedPinia).toBe(handle.ctx.pinia)
    expect(ctxPinia).toBe(handle.ctx.pinia)
    expect(handle.ctx.pinia.state.value['products/cart']).toEqual({ items: 0 })
    expect(setup).toHaveBeenCalledTimes(1)
    expect(setup).toHaveBeenCalledWith(handle.ctx)
  })

  it('unknown path renders the built-in 404 (mf-not-found)', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/nope/deep'),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.name).toBe('mf-not-found')
    expect(target.textContent).toMatch(/404|not found/i)
  })

  it('unknown path reuses the host route named "not-found"', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [
          { path: '/', component: Page('home') },
          { path: '/404', name: 'not-found', component: Page('host-404') },
        ],
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/missing'),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.name).toBe('mf-not-found')
    expect(handle.ctx.router.currentRoute.value.path).toBe('/missing')
    expect(target.textContent).toContain('host-404')
  })

  it('failed critical remote: useMfLayout() hides chrome', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        remotes: { remotes: [{ ...productsManifest.remotes[0]!, critical: true }] },
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/x'),
        runtime: fakeRuntime({ 'products/mf-meta': new Error('network down') }),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(target.querySelector('.chrome')).toBeNull()
    await handle.ctx.router.push('/')
    await new Promise((r) => setTimeout(r))
    expect(target.querySelector('.chrome')).not.toBeNull()
  })

  it('mount does not resolve before the first navigation (guard waits for auth.init)', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const user = { id: '1', name: 'A', permissions: [] }
    const adapter: AuthAdapter = {
      login: async () => user,
      logout: async () => {},
      refresh: async () => true,
      fetchUser: async () => {
        await gate
        return user
      },
      getAccessToken: () => 't',
    }
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home'), meta: { requiresAuth: true } }, { path: '/auth/login', component: Page('login') }],
        auth: adapter,
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
      }),
    )
    let done = false
    const p = handle.mount(el()).then(() => (done = true))
    await new Promise((r) => setTimeout(r, 20))
    expect(done).toBe(false)
    release()
    await p
    expect(handle.ctx.router.currentRoute.value.path).toBe('/')
    expect(handle.ctx.auth.isAuthenticated.value).toBe(true)
  })
})

describe('createStandaloneRemote', () => {
  const routes: RouteRecordRaw[] = [
    { path: '', name: 'list', component: Page('standalone-list') },
    { path: ':id', name: 'detail', component: Page('standalone-detail') },
  ]

  it('renders routePrefix with mock auth, authenticated, setup called once', async () => {
    let authed: boolean | undefined
    const Probe = defineComponent({
      setup() {
        const auth = useAuth()
        authed = auth.isAuthenticated.value
        return () => h('div', [h('span', 'probe'), h(RouterView)])
      },
    })
    const setup = vi.fn()
    const handle = track(
      await createStandaloneRemote({
        name: 'products',
        root: Probe,
        routes,
        routePrefix: '/products',
        setup,
        api: { baseURL: 'http://api' },
        history: historyAt('/products'),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.name).toBe('products/list')
    expect(target.textContent).toContain('standalone-list')
    expect(authed).toBe(true)
    expect(handle.ctx.auth.isAuthenticated.value).toBe(true)
    expect(setup).toHaveBeenCalledTimes(1)
    expect(setup).toHaveBeenCalledWith(handle.ctx)
  })

  it('default mock user passes meta.permissions gates (wildcard)', async () => {
    const handle = track(
      await createStandaloneRemote({
        name: 'products',
        routes: [{ path: 'admin', name: 'admin', component: Page('admin-page'), meta: { requiresAuth: true, permissions: ['products.admin', 'x'] } }],
        routePrefix: '/products',
        api: { baseURL: 'http://api' },
        history: historyAt('/products/admin'),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.path).toBe('/products/admin')
    expect(target.textContent).toContain('admin-page')
  })

  it('redirects / to routePrefix and scopes route names', async () => {
    const handle = track(
      await createStandaloneRemote({
        name: 'products',
        routes,
        routePrefix: '/products',
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.path).toBe('/products')
    expect(handle.ctx.router.hasRoute('products/detail')).toBe(true)
    await handle.ctx.router.push({ name: 'products/detail', params: { id: '7' } })
    expect(handle.ctx.router.currentRoute.value.path).toBe('/products/7')
  })
})
