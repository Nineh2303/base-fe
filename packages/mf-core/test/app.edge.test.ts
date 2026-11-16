import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'
import { defineStore } from 'pinia'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { createMfApp, useMfLayout, jwtAdapter, CORE_VERSION } from '../src/index'
import type { AuthAdapter, FederationRuntime, MfAppHandle } from '../src/index'

const Page = (label: string) => defineComponent({ name: label, render: () => h('div', { class: 'page' }, label) })
const Root = defineComponent({
  name: 'Root',
  setup() {
    const layout = useMfLayout()
    return () => h('div', { class: 'root' }, [layout.value ? h('nav', { class: 'chrome' }, 'nav') : null, h(RouterView)])
  },
})
function fakeRuntime(mods: Record<string, unknown>): FederationRuntime {
  return {
    register() {},
    async load<T>(id: string): Promise<T> {
      await Promise.resolve()
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
const track = <T extends MfAppHandle>(hd: T): T => {
  handles.push(hd)
  return hd
}
function el() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}
let axiosMock: MockAdapter
beforeEach(() => {
  localStorage.clear()
  axiosMock = new MockAdapter(axios)
})
afterEach(() => {
  axiosMock.restore()
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

const user = { id: '1', name: 'A', permissions: [] as string[] }
const loggedIn = (): AuthAdapter => ({
  login: async () => user,
  logout: async () => {},
  refresh: async () => true,
  fetchUser: async () => user,
  getAccessToken: () => 't',
})
const manifest = (...names: string[]) => ({
  remotes: names.map((n) => ({ name: n, entry: `http://localhost/${n}/remoteEntry.js`, routePrefix: `/${n}` })),
})
const goodMods = (name: string): Record<string, unknown> => ({
  [`${name}/mf-meta`]: { name, coreVersion: CORE_VERSION },
  [`${name}/routes`]: [{ path: 'secret', name: 'secret', component: Page(`${name}-secret`), meta: { requiresAuth: true } }],
})

describe('createMfApp edge cases', () => {
  it('deep link to requiresAuth remote route with jwt session in localStorage lands on the remote page', async () => {
    localStorage.setItem('mf-refresh-token', 'RT')
    axiosMock.onPost('/auth/refresh').reply(200, { accessToken: 'AT' })
    axiosMock.onGet('/auth/me').reply(200, user)
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/auth/login', component: Page('login') }],
        remotes: manifest('products'),
        auth: jwtAdapter({ baseURL: 'http://api' }),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/secret'),
        runtime: fakeRuntime(goodMods('products')),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.fullPath).toBe('/products/secret')
    expect(target.textContent).toContain('products-secret')
  })

  it('same deep link without a stored token redirects to login with redirect param', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/auth/login', component: Page('login') }],
        remotes: manifest('products'),
        auth: jwtAdapter({ baseURL: 'http://api' }),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/secret?x=1'),
        runtime: fakeRuntime(goodMods('products')),
      }),
    )
    const target = el()
    await handle.mount(target)
    const r = handle.ctx.router.currentRoute.value
    expect(r.path).toBe('/auth/login')
    expect(r.query.redirect).toBe('/products/secret?x=1')
    expect(target.textContent).toContain('login')
  })

  it('unknown path under a failed remote prefix shows the boundary error, not 404; elsewhere -> 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        remotes: manifest('products', 'orders'),
        auth: loggedIn(),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/does/not/exist'),
        runtime: fakeRuntime({ ...goodMods('orders'), 'products/mf-meta': new Error('down') }),
      }),
    )
    await handle.mount(el())
    expect(handle.ctx.router.currentRoute.value.name).toBe('products')
    await handle.ctx.router.push('/zzz')
    expect(handle.ctx.router.currentRoute.value.name).toBe('mf-not-found')
    await handle.ctx.router.push('/orders/unknown')
    expect(handle.ctx.router.currentRoute.value.name).toBe('mf-not-found')
  })

  it('critical failed remote: useMfLayout false there, true on a healthy route', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        remotes: { remotes: [{ name: 'core', entry: 'http://x/remoteEntry.js', routePrefix: '/core', critical: true }] },
        auth: loggedIn(),
        api: { baseURL: 'http://api' },
        history: historyAt('/core/x'),
        runtime: fakeRuntime({ 'core/mf-meta': new Error('down') }),
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(target.querySelector('.chrome')).toBeNull()
    await handle.ctx.router.push('/')
    await vi.waitFor(() => expect(target.querySelector('.chrome')).not.toBeNull())
  })

  it('onAuthFailure: logged out, at login with redirect = previous fullPath, no errors/warnings logged', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let tok: string | null = 't1'
    const adapter: AuthAdapter = {
      login: async () => user,
      logout: async () => {
        tok = null
      },
      refresh: async () => false,
      fetchUser: async () => user,
      getAccessToken: () => tok,
    }
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [
          { path: '/page', component: Page('page'), meta: { requiresAuth: true } },
          { path: '/auth/login', component: Page('login') },
        ],
        auth: adapter,
        api: { baseURL: 'http://api' },
        history: historyAt('/page?tab=2'),
      }),
    )
    await handle.mount(el())
    const m = new MockAdapter(handle.ctx.http)
    m.onGet('/a').reply(401)
    m.onGet('/b').reply(401)
    await Promise.allSettled([handle.ctx.http.get('/a'), handle.ctx.http.get('/b')])
    await vi.waitFor(() => expect(handle.ctx.router.currentRoute.value.path).toBe('/auth/login'))
    await new Promise((r) => setTimeout(r, 20))
    expect(handle.ctx.router.currentRoute.value.query.redirect).toBe('/page?tab=2')
    expect(handle.ctx.auth.isAuthenticated.value).toBe(false)
    expect(errSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('mount() twice does not create a second mounted app', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        routes: [{ path: '/', component: Page('home') }],
        auth: loggedIn(),
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
      }),
    )
    const a = el()
    const b = el()
    const p1 = handle.mount(a)
    const p2 = handle.mount(b)
    let outcome2: unknown = 'resolved'
    await p2.catch((e) => (outcome2 = e))
    await p1
    expect(a.querySelectorAll('.root')).toHaveLength(1)
    expect(b.querySelectorAll('.root')).toHaveLength(0)
    expect(outcome2 === 'resolved' || outcome2 instanceof Error).toBe(true)
  })

  it('one Pinia: store defined in a remote module is the instance registered in ctx.pinia._s', async () => {
    const useShared = defineStore('remote/shared', { state: () => ({ n: 1 }) })
    let fromComponent: unknown
    const C = defineComponent({
      setup() {
        fromComponent = useShared()
        return () => h('div', 'c')
      },
    })
    const handle = track(
      await createMfApp({
        root: Root,
        remotes: manifest('products'),
        auth: loggedIn(),
        api: { baseURL: 'http://api' },
        history: historyAt('/products/c'),
        runtime: fakeRuntime({
          'products/mf-meta': { name: 'products', coreVersion: CORE_VERSION },
          'products/routes': [{ path: 'c', component: C }],
        }),
      }),
    )
    await handle.mount(el())
    const registry = (handle.ctx.pinia as unknown as { _s: Map<string, unknown> })._s
    expect(registry.get('remote/shared')).toBe(fromComponent)
    expect(registry.size).toBeGreaterThanOrEqual(2)
  })
})
