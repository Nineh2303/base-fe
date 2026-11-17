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
      return mods[id] as T
    },
  }
}
const mods = (n: string, meta: unknown) => ({
  [`${n}/mf-meta`]: meta,
  [`${n}/routes`]: [{ path: '', name: 'list', component: Page(n) }],
})

async function status(host: string, remoteCore: unknown, name = 'r') {
  const router = makeRouter()
  const loader = createRemoteLoader({
    runtime: runtimeOf(mods(name, remoteCore === undefined ? undefined : { name, coreVersion: remoteCore })),
    router,
    ctxRef: () => ctx,
    coreVersion: host,
  })
  await loader.loadAll([entry(name)])
  return loader.remotes.value[0]!
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('loader version compatibility', () => {
  it.each([
    ['1.2.0', '1.9.3'],
    ['1.0.0', '1.0.0-beta.1'],
    ['0.1.0', '0.1.7'],
    ['1.0.0', 'v1.4.0'],
    ['1.0.0', '^1.2.0'],
    ['2.0.0', '2.0.0+build.5'],
  ])('host %s accepts remote %s', async (host, remote) => {
    expect((await status(host, remote)).status).toBe('ready')
  })

  it('0.x minor mismatch is rejected and says "0.x minor"', async () => {
    const r = await status('0.2.0', '0.1.9')
    expect(r.status).toBe('error')
    expect(r.error?.message).toMatch(/0\.x minor/)
  })

  it('major mismatch (1 vs 2, both directions) is rejected and says "major"', async () => {
    for (const [host, remote] of [['1.0.0', '2.0.0'], ['2.0.0', '1.9.0']] as const) {
      const r = await status(host, remote)
      expect(r.status).toBe('error')
      expect(r.error?.message).toMatch(/major version mismatch/)
    }
  })

  it('0.x host vs 1.x remote (and reverse) is a major mismatch', async () => {
    expect((await status('0.3.0', '1.0.0')).error?.message).toMatch(/major/)
    expect((await status('1.0.0', '0.3.0')).error?.message).toMatch(/major/)
  })

  it.each([
    ['undefined meta', undefined],
    ['null meta', null],
    ['meta without coreVersion', {}],
    ['numeric coreVersion', 1],
  ])('invalid ./mf-meta (%s) -> error status, routes not registered', async (_l, meta) => {
    const router = makeRouter()
    const m = mods('r', meta === 1 ? { name: 'r', coreVersion: 1 } : meta)
    const loader = createRemoteLoader({ runtime: runtimeOf(m), router, ctxRef: () => ctx, coreVersion: '1.0.0' })
    await loader.loadAll([entry('r')])
    expect(loader.remotes.value[0]!.status).toBe('error')
    expect(loader.remotes.value[0]!.error?.message).toMatch(/mf-meta/)
    expect(router.getRoutes().some((rt) => rt.path === '/r')).toBe(false)
  })

  it('a missing ./mf-meta expose (remote built without it) is an error, not a crash', async () => {
    const router = makeRouter()
    const loader = createRemoteLoader({
      runtime: runtimeOf({ 'r/routes': [] }),
      router,
      ctxRef: () => ctx,
      coreVersion: '1.0.0',
    })
    await loader.loadAll([entry('r')])
    expect(loader.remotes.value[0]!.status).toBe('error')
  })

  it('garbage coreVersion strings are rejected rather than accepted', async () => {
    expect((await status('1.0.0', '')).status).toBe('error')
    expect((await status('1.0.0', 'latest')).status).toBe('error')
  })

  it('meta name differing from the registered name only warns', async () => {
    const router = makeRouter()
    const loader = createRemoteLoader({
      runtime: runtimeOf(mods('r', { name: 'other', coreVersion: '1.0.0' })),
      router,
      ctxRef: () => ctx,
      coreVersion: '1.0.0',
    })
    await loader.loadAll([entry('r')])
    expect(loader.remotes.value[0]!.status).toBe('ready')
    expect(console.warn).toHaveBeenCalled()
  })

  it('routes that is not an array -> error', async () => {
    const router = makeRouter()
    const loader = createRemoteLoader({
      runtime: runtimeOf({ 'r/mf-meta': { name: 'r', coreVersion: '1.0.0' }, 'r/routes': { path: '/x' } }),
      router,
      ctxRef: () => ctx,
      coreVersion: '1.0.0',
    })
    await loader.loadAll([entry('r')])
    expect(loader.remotes.value[0]!.error?.message).toMatch(/array of routes/)
  })

  it('setup that is not a function -> error', async () => {
    const router = makeRouter()
    const loader = createRemoteLoader({
      runtime: runtimeOf({ ...mods('r', { name: 'r', coreVersion: '1.0.0' }), 'r/setup': { notAFn: true } }),
      router,
      ctxRef: () => ctx,
      coreVersion: '1.0.0',
    })
    await loader.loadAll([entry('r')])
    expect(loader.remotes.value[0]!.error?.message).toMatch(/setup must export a function/)
  })

  it('a second loadAll with an already-loaded name/prefix is ignored (no duplicate routes)', async () => {
    const router = makeRouter()
    const loader = createRemoteLoader({
      runtime: runtimeOf(mods('r', { name: 'r', coreVersion: '1.0.0' })),
      router,
      ctxRef: () => ctx,
      coreVersion: '1.0.0',
    })
    await loader.loadAll([entry('r')])
    await loader.loadAll([entry('r')])
    expect(loader.remotes.value).toHaveLength(1)
    expect(router.getRoutes().filter((rt) => rt.name === 'r')).toHaveLength(1)
  })

  it('routePrefix collision is case-insensitive', async () => {
    const router = makeRouter()
    const loader = createRemoteLoader({
      runtime: runtimeOf({ ...mods('a', { name: 'a', coreVersion: '1.0.0' }), ...mods('b', { name: 'b', coreVersion: '1.0.0' }) }),
      router,
      ctxRef: () => ctx,
      coreVersion: '1.0.0',
    })
    await loader.loadAll([entry('a', '/Shop'), entry('b', '/shop')])
    expect(loader.remotes.value.map((r) => r.name)).toEqual(['a'])
  })
})

describe('manifest parsing gaps', () => {
  it('duplicate name / routePrefix are NOT parse errors (loader resolves them: first wins)', () => {
    const { remotes, errors } = parseManifest({
      remotes: [
        { name: 'a', entry: 'u1', routePrefix: '/a' },
        { name: 'a', entry: 'u2', routePrefix: '/a2' },
        { name: 'b', entry: 'u3', routePrefix: '/a' },
      ],
    })
    expect(errors).toEqual([])
    expect(remotes.map((r) => r.name)).toEqual(['a', 'a', 'b'])
  })

  it('trims entry URL, rejects whitespace-only entry, and collapses repeated trailing slashes', () => {
    const { remotes, errors } = parseManifest({
      remotes: [
        { name: 'a', entry: '  http://x/a.js  ', routePrefix: '/a///' },
        { name: 'b', entry: '   ', routePrefix: '/b' },
      ],
    })
    expect(remotes).toEqual([{ name: 'a', entry: 'http://x/a.js', routePrefix: '/a' }])
    expect(errors).toHaveLength(1)
  })

  it('"//" and "/" routePrefix are rejected as root', () => {
    const { remotes, errors } = parseManifest({ remotes: [{ name: 'a', entry: 'u', routePrefix: '//' }] })
    expect(remotes).toEqual([])
    expect(errors[0]).toMatch(/root/)
  })

  it('bad critical/menu are ignored with an error but the entry survives', () => {
    const { remotes, errors } = parseManifest({
      remotes: [{ name: 'a', entry: 'u', routePrefix: '/a', critical: 'yes', menu: { order: 1 } }],
    })
    expect(remotes).toEqual([{ name: 'a', entry: 'u', routePrefix: '/a' }])
    expect(errors).toHaveLength(2)
  })

  it('menu.order non-number is dropped; label kept', () => {
    const { remotes } = parseManifest({ remotes: [{ name: 'a', entry: 'u', routePrefix: '/a', menu: { label: 'A', order: '3' } }] })
    expect(remotes[0]!.menu).toEqual({ label: 'A' })
  })

  it('names that are reserved-looking but valid identifiers pass; names with dashes/dots/slashes fail', () => {
    const { remotes } = parseManifest({
      remotes: ['a-b', 'a.b', 'a/b', '1a', '', 'ok_1', '$x'].map((name) => ({ name, entry: 'u', routePrefix: '/p' + name.length })),
    })
    expect(remotes.map((r) => r.name)).toEqual(['ok_1', '$x'])
  })

  it('loadManifest: inline object source with an entry error still returns valid remotes', async () => {
    const res = await loadManifest({ remotes: [{ name: 'a', entry: 'u', routePrefix: '/a' }, { name: 'bad name' } as never] })
    expect(res.remotes).toHaveLength(1)
    expect(res.errors).toHaveLength(1)
  })

  it('loadManifest: URL source sends Accept json, 500 error includes status, non-array remotes reported', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
    vi.stubGlobal('fetch', fetchMock)
    const res = await loadManifest('http://m/remotes.json')
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: { Accept: 'application/json' } })
    expect(res.remotes).toEqual([])
    expect(res.errors[0]).toMatch(/HTTP 500/)
    expect(res.errors[0]).toMatch(/http:\/\/m\/remotes\.json/)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ remotes: {} }) })
    expect((await loadManifest('http://m/x')).errors[0]).toMatch(/"remotes" array/)
    vi.unstubAllGlobals()
  })

  it('loadManifest: a hanging fetch is not guarded here (documented): factory resolving null gives a clean error', async () => {
    const res = await loadManifest((async () => null) as never)
    expect(res.remotes).toEqual([])
    expect(res.errors).toHaveLength(1)
  })
})
