import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { Router, RouteRecordRaw } from 'vue-router'
import { createRemoteLoader, defineRemoteComponent } from '../../src/remotes/loader'
import type { FederationRuntime } from '../../src/remotes/loader'
import RemoteErrorPage from '../../src/remotes/RemoteErrorPage.vue'
import RemoteBoundary from '../../src/remotes/RemoteBoundary.vue'
import type { MfContext, RemoteEntry } from '../../src/types'

type ModMap = Record<string, unknown>

function fakeRuntime(mods: ModMap) {
  const registered: { name: string; entry: string }[] = []
  const loads: string[] = []
  const runtime: FederationRuntime = {
    register(remotes) {
      registered.push(...remotes)
    },
    async load<T>(id: string): Promise<T> {
      loads.push(id)
      await Promise.resolve()
      if (!(id in mods)) throw new Error(`[Module Federation] Module ./${id.split('/').slice(1).join('/')} does not exist in container.`)
      const v = mods[id]
      if (v instanceof Error) throw v
      return v as T
    },
  }
  return { runtime, registered, loads }
}

const Page = (label: string) => defineComponent({ name: label, render: () => h('div', { class: 'page' }, label) })

function remoteMods(name: string, opts: { coreVersion?: string; routes?: RouteRecordRaw[]; setup?: unknown; wrapDefault?: boolean } = {}): ModMap {
  const routes = opts.routes ?? [
    { path: '', name: 'list', component: Page(`${name}-list`) },
    { path: ':id', name: 'detail', component: Page(`${name}-detail`) },
  ]
  const meta = { name, coreVersion: opts.coreVersion ?? '1.3.0' }
  const m: ModMap = {
    [`${name}/mf-meta`]: opts.wrapDefault ? { default: meta } : meta,
    [`${name}/routes`]: opts.wrapDefault ? { default: routes } : routes,
  }
  if (opts.setup) m[`${name}/setup`] = opts.wrapDefault ? { default: opts.setup } : opts.setup
  return m
}

const entry = (name: string, extra: Partial<RemoteEntry> = {}): RemoteEntry => ({
  name,
  entry: `http://localhost/${name}/remoteEntry.js`,
  routePrefix: `/${name}`,
  ...extra,
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: Page('home') }],
  })
}

const ctx = { marker: 'ctx' } as unknown as MfContext

async function flush() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

const mounted: Array<() => void> = []
function mountWith(router: Router | null, render: () => unknown) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render })
  if (router) app.use(router)
  app.config.warnHandler = () => {}
  app.mount(el)
  mounted.push(() => {
    app.unmount()
    el.remove()
  })
  return el
}

let errSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  mounted.splice(0).forEach((u) => u())
  vi.restoreAllMocks()
})

describe('createRemoteLoader', () => {
  it('loads a healthy remote: registers, mounts routes under the prefix, calls setup with ctx', async () => {
    const setup = vi.fn()
    const { runtime, registered, loads } = fakeRuntime(remoteMods('products', { setup }))
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    await loader.ready

    expect(registered).toEqual([{ name: 'products', entry: 'http://localhost/products/remoteEntry.js' }])
    expect(loads).toEqual(['products/mf-meta', 'products/routes', 'products/setup'])
    expect(setup).toHaveBeenCalledWith(ctx)
    expect(loader.remotes.value).toHaveLength(1)
    expect(loader.remotes.value[0]).toMatchObject({ name: 'products', status: 'ready' })
    expect(loader.remotes.value[0]!.error).toBeUndefined()

    const r = router.resolve('/products/')
    expect(r.matched.length).toBe(2)
    expect(r.matched[0]!.name).toBe('products')
    expect(r.name).toBe('products/list')
    expect(router.resolve('/products/42').name).toBe('products/detail')
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('renders remote pages through RemoteHost (boundary + RouterView)', async () => {
    const { runtime } = fakeRuntime(remoteMods('products'))
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    const el = mountWith(router, () => h(RouterView))
    await router.push('/products/7')
    await flush()
    expect(el.textContent).toContain('products-detail')
  })

  it('accepts modules with a default export and a missing setup (no error logged)', async () => {
    const { runtime, loads } = fakeRuntime(remoteMods('products', { wrapDefault: true }))
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    expect(loads).toContain('products/setup')
    expect(loader.remotes.value[0]!.status).toBe('ready')
    expect(router.resolve('/products/').name).toBe('products/list')
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('calls a default-exported setup', async () => {
    const setup = vi.fn(async () => {})
    const { runtime } = fakeRuntime(remoteMods('products', { setup, wrapDefault: true }))
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    expect(setup).toHaveBeenCalledWith(ctx)
  })

  it('prefixes nested child route names with the remote name', async () => {
    const routes: RouteRecordRaw[] = [
      {
        path: '/settings',
        name: 'settings',
        component: Page('settings'),
        children: [{ path: 'profile', name: 'profile', component: Page('profile') }],
      },
      { path: 'about', component: Page('about') },
    ]
    const { runtime } = fakeRuntime(remoteMods('products', { routes }))
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    expect(router.resolve('/products/settings/profile').name).toBe('products/profile')
    expect(router.hasRoute('products/settings')).toBe(true)
    expect(router.resolve('/products/about').matched.length).toBe(2)
  })

  it('major mismatch → routes not loaded, status error mentioning major, boundary error shown', async () => {
    const { runtime, loads } = fakeRuntime(remoteMods('products', { coreVersion: '2.0.0' }))
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])

    expect(loads).toEqual(['products/mf-meta'])
    const r = loader.remotes.value[0]!
    expect(r.status).toBe('error')
    expect(r.error?.message).toMatch(/major/)
    expect(errSpy).toHaveBeenCalled()
    expect(String(errSpy.mock.calls[0]![0])).toContain('[mf-core]')

    const el = mountWith(router, () => h(RouterView))
    await router.push('/products/x')
    await flush()
    const box = el.querySelector('.mf-remote-error')
    expect(box).not.toBeNull()
    expect(box!.textContent).toMatch(/major/)
    expect(router.currentRoute.value.matched[0]!.components!.default).not.toBe(RemoteErrorPage)
  })

  it.each([
    ['0.1.0', '0.2.0', 'error'],
    ['0.2.0', '0.1.0', 'error'],
    ['0.1.0', '0.1.5', 'ready'],
    ['1.3.0', '1.9.0', 'ready'],
    ['1.3.0', '0.3.0', 'error'],
  ] as const)('compatibility: host %s vs remote %s → %s', async (host, remote, expected) => {
    const { runtime, loads } = fakeRuntime(remoteMods('products', { coreVersion: remote }))
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx, coreVersion: host })
    await loader.loadAll([entry('products')])
    const r = loader.remotes.value[0]!
    expect(r.status).toBe(expected)
    if (expected === 'error') {
      expect(r.error?.message).toMatch(/incompatible version/)
      expect(loads).toEqual(['products/mf-meta'])
    }
  })

  it('the bare prefix of a failed remote also shows the error', async () => {
    const { runtime } = fakeRuntime(remoteMods('products', { coreVersion: '2.0.0' }))
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    expect(router.resolve('/products').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/products').name).not.toBeUndefined()
  })

  it('routes rejection → that remote errors, others stay ready', async () => {
    const mods = {
      ...remoteMods('products'),
      ...remoteMods('orders'),
      'products/routes': new Error('chunk failed'),
    }
    const { runtime } = fakeRuntime(mods)
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products'), entry('orders')])
    const [p, o] = loader.remotes.value
    expect(p).toMatchObject({ name: 'products', status: 'error' })
    expect(p!.error?.message).toBe('chunk failed')
    expect(o).toMatchObject({ name: 'orders', status: 'ready' })
    expect(router.resolve('/orders/').name).toBe('orders/list')
    expect(errSpy).toHaveBeenCalledTimes(1)
  })

  it('a throwing setup marks the remote as error', async () => {
    const setup = vi.fn(() => {
      throw new Error('setup broke')
    })
    const { runtime } = fakeRuntime(remoteMods('products', { setup }))
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('products')])
    expect(loader.remotes.value[0]).toMatchObject({ status: 'error' })
    expect(loader.remotes.value[0]!.error?.message).toBe('setup broke')
  })

  it('critical remote failure → catch-all /auth/* renders RemoteErrorPage with mfLayout: false', async () => {
    const { runtime } = fakeRuntime({ 'auth/mf-meta': new Error('network down') })
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('auth', { critical: true })])
    expect(loader.remotes.value[0]!.status).toBe('error')

    for (const path of ['/auth', '/auth/login', '/auth/a/b/c']) {
      const r = router.resolve(path)
      expect(r.matched.length).toBe(1)
      expect(r.meta.mfLayout).toBe(false)
    }
    const el = mountWith(router, () => h(RouterView))
    await router.push('/auth/login')
    await flush()
    const page = el.querySelector('[data-test="mf-critical-error"]')
    expect(page).not.toBeNull()
    expect(page!.textContent).toContain('network down')
    expect(el.querySelector('.mf-remote-error')).toBeNull()
  })

  it('critical retry reloads the page', async () => {
    const reload = vi.fn()
    const orig = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...orig, reload } })
    try {
      const { runtime } = fakeRuntime({ 'auth/mf-meta': new Error('network down') })
      const router = makeRouter()
      const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
      await loader.loadAll([entry('auth', { critical: true })])
      const el = mountWith(router, () => h(RouterView))
      await router.push('/auth')
      await flush()
      ;(el.querySelector('[data-test="mf-retry"]') as HTMLButtonElement).click()
      expect(reload).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: orig })
    }
  })

  it('duplicate name or routePrefix → later remote skipped with console.warn, first ready', async () => {
    const { runtime, registered } = fakeRuntime({ ...remoteMods('products'), ...remoteMods('other') })
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([
      entry('products'),
      entry('products', { routePrefix: '/p2' }),
      entry('other', { routePrefix: '/products' }),
    ])
    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(String(warnSpy.mock.calls[0]![0])).toContain('[mf-core]')
    expect(registered.map((r) => r.name)).toEqual(['products'])
    expect(loader.remotes.value).toHaveLength(1)
    expect(loader.remotes.value[0]).toMatchObject({ name: 'products', status: 'ready' })
    expect(router.resolve('/p2').matched.length).toBe(0)
  })

  it('remote named like an existing host route → skipped with warn, status error, host route intact', async () => {
    const { runtime, registered } = fakeRuntime({ ...remoteMods('home'), ...remoteMods('other') })
    const router = makeRouter() // has host route named "home"
    const loader = createRemoteLoader({ runtime, router, ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('home'), entry('other')])
    expect(warnSpy.mock.calls.some((c) => /\[mf-core\].*"home".*host route/.test(String(c[0])))).toBe(true)
    expect(registered.map((r) => r.name)).toEqual(['other'])
    expect(loader.remotes.value.find((r) => r.name === 'home')).toMatchObject({ status: 'error' })
    expect(loader.remotes.value.find((r) => r.name === 'home')!.error!.message).toMatch(/host route/)
    expect(loader.remotes.value.find((r) => r.name === 'other')).toMatchObject({ status: 'ready' })
    expect(router.resolve('/').name).toBe('home')
    expect(router.resolve('/').matched[0]!.path).toBe('/')
    expect(router.resolve('/home').matched.length).toBe(0)
  })

  it('loads remotes in parallel', async () => {
    let resolveA!: (v: unknown) => void
    const loads: string[] = []
    const runtime: FederationRuntime = {
      register() {},
      async load<T>(id: string): Promise<T> {
        loads.push(id)
        if (id === 'a/mf-meta') return new Promise((r) => (resolveA = r as (v: unknown) => void)) as Promise<T>
        const mods = { ...remoteMods('a'), ...remoteMods('b') }
        if (!(id in mods)) throw new Error(`Module ./${id.split('/')[1]} does not exist in container.`)
        return mods[id] as T
      },
    }
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx, coreVersion: '1.3.0' })
    const done = loader.loadAll([entry('a'), entry('b')])
    await flush()
    expect(loads).toContain('b/routes')
    expect(loader.remotes.value.map((r) => r.status)).toEqual(['loading', 'ready'])
    resolveA({ name: 'a', coreVersion: '1.0.0' })
    await done
    expect(loader.remotes.value.map((r) => r.status)).toEqual(['ready', 'ready'])
  })

  it('register throwing is contained to that remote', async () => {
    const { runtime } = fakeRuntime(remoteMods('ok'))
    const base = runtime.register
    runtime.register = (remotes) => {
      if (remotes[0]!.name === 'bad') throw new Error('bad entry')
      base(remotes)
    }
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx, coreVersion: '1.3.0' })
    await loader.loadAll([entry('bad'), entry('ok')])
    expect(loader.remotes.value.map((r) => r.status)).toEqual(['error', 'ready'])
  })

  it('loadAll never rejects when every remote fails; ready resolves', async () => {
    const runtime: FederationRuntime = {
      register() {
        throw new Error('nope')
      },
      load() {
        return Promise.reject(new Error('nope'))
      },
    }
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx, coreVersion: '1.3.0' })
    let settled = false
    loader.ready.then(() => (settled = true))
    await flush()
    expect(settled).toBe(false)
    await expect(loader.loadAll([entry('a'), entry('b', { critical: true })])).resolves.toBeUndefined()
    await loader.ready
    expect(settled).toBe(true)
    expect(loader.remotes.value.every((r) => r.status === 'error')).toBe(true)
  })

  it('loadAll with no entries resolves ready', async () => {
    const loader = createRemoteLoader({ runtime: fakeRuntime({}).runtime, router: makeRouter(), ctxRef: () => ctx })
    await loader.loadAll([])
    await expect(loader.ready).resolves.toBeUndefined()
    expect(loader.remotes.value).toEqual([])
  })

  it('defaults coreVersion to CORE_VERSION', async () => {
    const { CORE_VERSION } = await import('../../src/version')
    const { runtime } = fakeRuntime(remoteMods('products', { coreVersion: CORE_VERSION }))
    const loader = createRemoteLoader({ runtime, router: makeRouter(), ctxRef: () => ctx })
    await loader.loadAll([entry('products')])
    expect(loader.remotes.value[0]!.status).toBe('ready')
  })
})

describe('defineRemoteComponent', () => {
  it('renders the component loaded from the runtime', async () => {
    const Widget = defineComponent({ props: { label: String }, render() { return h('span', { class: 'widget' }, `W:${this.label}`) } })
    const { runtime, loads } = fakeRuntime({ 'products/Widget': { default: Widget } })
    const C = defineRemoteComponent('products/Widget', { runtime })
    const el = mountWith(null, () => h(C, { label: 'hi' }))
    await flush()
    expect(loads).toEqual(['products/Widget'])
    expect(el.querySelector('.widget')?.textContent).toBe('W:hi')
  })

  it('shows .mf-remote-error when load rejects, and retry loads again', async () => {
    const Widget = defineComponent({ render: () => h('span', { class: 'widget' }, 'ok') })
    const mods: ModMap = { 'products/Widget': new Error('widget gone') }
    const { runtime, loads } = fakeRuntime(mods)
    const C = defineRemoteComponent('products/Widget', { runtime })
    const el = mountWith(null, () => h(C))
    await flush()
    const box = el.querySelector('.mf-remote-error')
    expect(box).not.toBeNull()
    expect(box!.textContent).toContain('widget gone')
    expect(box!.querySelector('strong')!.textContent).toBe('Không tải được products/Widget')

    mods['products/Widget'] = Widget
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLButtonElement).click()
    await flush()
    expect(loads).toEqual(['products/Widget', 'products/Widget'])
    expect(el.querySelector('.widget')?.textContent).toBe('ok')
  })

  it('wraps in RemoteBoundary named after the id', async () => {
    const { runtime } = fakeRuntime({ 'products/Widget': defineComponent({ render: () => h('i') }) })
    const C = defineRemoteComponent('products/Widget', { runtime })
    let found = false
    const Probe = defineComponent({
      setup() {
        return () => h(C)
      },
      mounted() {
        const walk = (v: { type?: unknown; component?: { subTree: unknown } | null; props?: Record<string, unknown> | null } | null): void => {
          if (!v) return
          if (v.type === RemoteBoundary && v.props?.name === 'products/Widget') found = true
          if (v.component) walk(v.component.subTree as never)
        }
        walk((this as unknown as { $: { subTree: never } }).$.subTree)
      },
    })
    mountWith(null, () => h(Probe))
    await flush()
    expect(found).toBe(true)
  })
})
