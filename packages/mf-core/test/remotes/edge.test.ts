import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createRemoteLoader } from '../../src/remotes/loader'
import type { FederationRuntime } from '../../src/remotes/loader'
import { loadManifest, parseManifest } from '../../src/remotes/manifest'
import type { MfContext, RemoteEntry } from '../../src/types'

const Page = (label: string) => defineComponent({ name: label, render: () => h('div', label) })
const ctx = {} as MfContext
const entry = (name: string, routePrefix = `/${name}`): RemoteEntry => ({ name, entry: `http://x/${name}.js`, routePrefix })
const makeRouter = () => createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Page('home') }] })

function runtimeOf(mods: Record<string, unknown>): FederationRuntime {
  return {
    register() {},
    async load<T>(id: string): Promise<T> {
      if (!(id in mods)) throw new Error(`Module ./${id.split('/')[1]} does not exist in container.`)
      const v = mods[id]
      return (typeof v === 'function' ? await (v as () => Promise<unknown>)() : v) as T
    },
  }
}
const good = (n: string, extra: Record<string, unknown> = {}) => ({
  [`${n}/mf-meta`]: { name: n, coreVersion: '1.0.0' },
  [`${n}/routes`]: [{ path: '', name: 'list', component: Page(n) }],
  ...extra,
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('manifest robustness', () => {
  it('handles malformed top-level shapes and extra fields', () => {
    for (const bad of [{ remotes: 'x' }, null, [], [{ name: 'a' }], 'str', 42]) {
      const r = parseManifest(bad)
      expect(r.remotes).toEqual([])
      expect(r.errors).toHaveLength(1)
    }
    const r = parseManifest({ remotes: [{ ...entry('Prod_UCTS', '/p/'), extra: 1, nested: { a: 1 } }] })
    expect(r.errors).toEqual([])
    expect(r.remotes).toEqual([{ name: 'Prod_UCTS', entry: 'http://x/Prod_UCTS.js', routePrefix: '/p' }])
    expect(parseManifest({ remotes: [{ ...entry('a'), name: 'my-remote' }] }).remotes).toEqual([])
  })

  it('sync-throwing and rejecting factories both give a clean error', async () => {
    const sync = await loadManifest((() => {
      throw new Error('boom')
    }) as never)
    const rejecting = await loadManifest(() => Promise.reject(new Error('nope')))
    for (const r of [sync, rejecting]) {
      expect(r.remotes).toEqual([])
      expect(r.errors).toHaveLength(1)
    }
  })

  it('HTML (SPA fallback) served for remotes.json is a clean error', async () => {
    vi.stubGlobal('fetch', async () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    const r = await loadManifest('http://x/remotes.json')
    expect(r.remotes).toEqual([])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/invalid JSON/)
  })
})

describe('loader conflicts', () => {
  it('duplicate name AND prefix in one manifest: each later entry skipped with a warning', async () => {
    const mods = { ...good('a'), ...good('b'), ...good('c') }
    const loader = createRemoteLoader({ runtime: runtimeOf(mods), router: makeRouter(), ctxRef: () => ctx, coreVersion: '1.0.0' })
    await loader.loadAll([entry('a'), entry('a', '/other'), entry('b', '/a'), entry('c')])
    expect(loader.remotes.value.map((r) => [r.name, r.status])).toEqual([
      ['a', 'ready'],
      ['c', 'ready'],
    ])
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it('nested prefixes (/products vs /products/admin) both load; the more specific one wins', async () => {
    const router = makeRouter()
    const mods = {
      ...good('products'),
      'admin/mf-meta': { name: 'admin', coreVersion: '1.0.0' },
      'admin/routes': [{ path: '', name: 'home', component: Page('admin') }],
    }
    const loader = createRemoteLoader({ runtime: runtimeOf(mods), router, ctxRef: () => ctx, coreVersion: '1.0.0' })
    await loader.loadAll([entry('products'), entry('admin', '/products/admin')])
    expect(loader.remotes.value.map((x) => x.status)).toEqual(['ready', 'ready'])
    expect(router.resolve('/products/admin').name).toBe('admin/home')
    expect(router.resolve('/products').name).toBe('products/list')
  })
})

describe('timeout and setup failure', () => {
  it('a hanging remote is marked error after timeoutMs and does not block ready; late completion adds no routes', async () => {
    vi.useFakeTimers()
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    const mods = {
      ...good('slow', { 'slow/mf-meta': async () => (await gate, { name: 'slow', coreVersion: '1.0.0' }) }),
      ...good('fast'),
    }
    const router = makeRouter()
    const loader = createRemoteLoader({ runtime: runtimeOf(mods), router, ctxRef: () => ctx, coreVersion: '1.0.0', timeoutMs: 5000 })
    void loader.loadAll([entry('slow'), entry('fast')])
    let done = false
    void loader.ready.then(() => (done = true))
    await vi.advanceTimersByTimeAsync(4999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(done).toBe(true)
    const byName = Object.fromEntries(loader.remotes.value.map((x) => [x.name, x]))
    expect(byName.fast!.status).toBe('ready')
    expect(byName.slow!.status).toBe('error')
    expect(byName.slow!.error!.message).toMatch(/timeout/)
    release()
    await vi.advanceTimersByTimeAsync(10)
    // only the error catch-all route exists for the slow remote; its real routes were never added
    expect(router.resolve('/slow/x').matched).toHaveLength(1)
    expect(loader.remotes.value.find((x) => x.name === 'slow')!.status).toBe('error')
  })

  it('setup throwing: status error, no half-registered routes (error catch-all only)', async () => {
    const router = makeRouter()
    const mods = good('s', {
      's/setup': () =>
        Promise.resolve(() => {
          throw new Error('setup boom')
        }),
    })
    const loader = createRemoteLoader({ runtime: runtimeOf(mods), router, ctxRef: () => ctx, coreVersion: '1.0.0' })
    await loader.loadAll([entry('s')])
    expect(loader.remotes.value[0]).toMatchObject({ status: 'error' })
    expect(loader.remotes.value[0]!.error!.message).toBe('setup boom')
    expect(router.resolve('/s').name).toBe('s')
    expect(router.resolve('/s').matched).toHaveLength(1)
  })
})
