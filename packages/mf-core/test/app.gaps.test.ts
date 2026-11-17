import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'
import { createMfApp, createStandaloneRemote, createMockAuthAdapter, CORE_VERSION } from '../src/index'
import type { FederationRuntime, MfAppHandle } from '../src/index'
import RemoteBoundary from '../src/remotes/RemoteBoundary.vue'
import { useMfPortalTarget } from '../src/app/portal'

const Page = (label: string) => defineComponent({ name: label, render: () => h('div', { class: 'page' }, label) })
const Root = defineComponent({ name: 'Root', render: () => h(RouterView) })

function historyAt(path: string) {
  const history = createMemoryHistory()
  history.replace(path)
  return history
}
const handles: MfAppHandle[] = []
const track = <T extends MfAppHandle>(hd: T): T => (handles.push(hd), hd)
function el() {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  for (const hd of handles.splice(0)) {
    try {
      hd.app.unmount()
    } catch {
      /* not mounted */
    }
  }
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const routes = [{ path: '', name: 'list', component: Page('standalone-list') }]

describe('createStandaloneRemote option validation', () => {
  it.each(['products', '', '/', '//', 'http://x'])('routePrefix %j is rejected with a clear error', async (routePrefix) => {
    await expect(
      createStandaloneRemote({ name: 'p', routes, routePrefix, api: { baseURL: 'http://api' }, history: historyAt('/') }),
    ).rejects.toThrow(/routePrefix must start with "\/"/)
  })

  it('trailing slashes on a valid routePrefix are normalised ("/p//" behaves as "/p")', async () => {
    const handle = track(
      await createStandaloneRemote({ name: 'p', routes, routePrefix: '/p//', api: { baseURL: 'http://api' }, history: historyAt('/p') }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.name).toBe('p/list')
    expect(target.textContent).toContain('standalone-list')
  })

  it('a throwing setup rejects createStandaloneRemote (not swallowed)', async () => {
    await expect(
      createStandaloneRemote({
        name: 'p',
        routes,
        routePrefix: '/p',
        setup: () => {
          throw new Error('setup failed')
        },
        api: { baseURL: 'http://api' },
        history: historyAt('/p'),
      }),
    ).rejects.toThrow('setup failed')
  })

  it('async setup is awaited before the handle resolves', async () => {
    let done = false
    await createStandaloneRemote({
      name: 'p',
      routes,
      routePrefix: '/p',
      setup: async () => {
        await new Promise((r) => setTimeout(r, 20))
        done = true
      },
      api: { baseURL: 'http://api' },
      history: historyAt('/p'),
    }).then(track)
    expect(done).toBe(true)
  })

  it('an unauthenticated custom auth adapter is redirected to the (custom) loginPath', async () => {
    const handle = track(
      await createStandaloneRemote({
        name: 'p',
        routes: [{ path: '', name: 'list', component: Page('x'), meta: { requiresAuth: true } }],
        routePrefix: '/p',
        auth: createMockAuthAdapter(),
        loginPath: '/signin',
        api: { baseURL: 'http://api' },
        history: historyAt('/p'),
      }),
    )
    handle.ctx.router.addRoute({ path: '/signin', component: Page('signin') })
    await handle.mount(el())
    expect(handle.ctx.router.currentRoute.value.path).toBe('/signin')
  })
})

describe('createMfApp gaps', () => {
  const okRuntime = (names: string[]): FederationRuntime => ({
    register() {},
    async load<T>(id: string): Promise<T> {
      const [n, expose] = id.split('/')
      if (!names.includes(n!)) throw new Error(`Module ./${expose} does not exist in container.`)
      if (expose === 'mf-meta') return { name: n, coreVersion: CORE_VERSION } as T
      if (expose === 'routes') return [{ path: '', name: 'list', component: Page(`${n}-page`) }] as T
      throw new Error(`Module ./${expose} does not exist in container.`)
    },
  })

  it('duplicate remote names/prefixes in the manifest: app still mounts, first remote serves its prefix', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        auth: createMockAuthAdapter({ autoLogin: true }),
        api: { baseURL: 'http://api' },
        history: historyAt('/a'),
        runtime: okRuntime(['a', 'b']),
        remotes: {
          remotes: [
            { name: 'a', entry: 'u1', routePrefix: '/a' },
            { name: 'a', entry: 'u2', routePrefix: '/a2' },
            { name: 'b', entry: 'u3', routePrefix: '/a' },
          ],
        },
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(target.textContent).toContain('a-page')
    expect(handle.ctx.remotes.value.map((r) => r.name)).toEqual(['a'])
  })

  it('custom forbiddenPath: a permission-gated host route lands there', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        auth: createMockAuthAdapter({ autoLogin: true, user: { id: '1', name: 'u', permissions: [] } }),
        api: { baseURL: 'http://api' },
        forbiddenPath: '/nope',
        history: historyAt('/admin'),
        routes: [
          { path: '/admin', component: Page('admin'), meta: { requiresAuth: true, permissions: ['admin'] } },
          { path: '/nope', component: Page('forbidden-page') },
        ],
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.path).toBe('/nope')
    expect(target.textContent).toContain('forbidden-page')
  })

  it('default login path is /auth/login (README default) for anonymous deep links', async () => {
    const handle = track(
      await createMfApp({
        root: Root,
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/secret'),
        routes: [
          { path: '/secret', component: Page('s'), meta: { requiresAuth: true } },
          { path: '/auth/login', component: Page('login-page') },
        ],
      }),
    )
    const target = el()
    await handle.mount(target)
    expect(handle.ctx.router.currentRoute.value.fullPath).toBe('/auth/login?redirect=/secret')
  })

  it('mount() with an unreachable manifest URL still mounts and logs the error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const handle = track(
      await createMfApp({
        root: Root,
        auth: createMockAuthAdapter(),
        api: { baseURL: 'http://api' },
        history: historyAt('/'),
        routes: [{ path: '/', component: Page('home') }],
        remotes: 'http://m/remotes.json',
      }),
    )
    const seen: string[] = []
    handle.ctx.bus.on('notify', (n) => seen.push(n.message))
    await handle.mount(el())
    expect(handle.ctx.router.currentRoute.value.path).toBe('/')
    expect(console.error).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('portal target gaps', () => {
  it('useMfPortalTarget resolves to the boundary portal element (data-mf-portal) once mounted', async () => {
    const show = ref(true)
    let target: ReturnType<typeof useMfPortalTarget> | undefined
    const Inner = defineComponent({
      setup() {
        target = useMfPortalTarget()
        return () => h('i')
      },
    })
    const root = el()
    const app = createApp({ render: () => (show.value ? h(RemoteBoundary, { name: 'r' }, { default: () => h(Inner) }) : h('b')) })
    app.mount(root)
    await nextTick()
    await nextTick()
    expect(target!.value).toBeInstanceOf(HTMLElement)
    expect((target!.value as HTMLElement).hasAttribute('data-mf-portal')).toBe(true)
    const first = target!.value
    show.value = false
    await nextTick()
    expect(first).toBeInstanceOf(HTMLElement)
    app.unmount()
  })
})
