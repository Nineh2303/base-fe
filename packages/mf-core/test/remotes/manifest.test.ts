import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseManifest, loadManifest } from '../../src/remotes/manifest'

const valid = {
  remotes: [
    { name: 'products', entry: 'http://localhost:5001/remoteEntry.js', routePrefix: '/products', menu: { label: 'Products', order: 1 } },
    { name: 'auth', entry: 'http://localhost:5002/mf-manifest.json', routePrefix: '/auth/', critical: true },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('parseManifest', () => {
  it('accepts a valid manifest with all entries', () => {
    const { remotes, errors } = parseManifest(valid)
    expect(errors).toEqual([])
    expect(remotes).toHaveLength(2)
    expect(remotes[0]).toEqual(valid.remotes[0])
    expect(remotes[1]).toMatchObject({ name: 'auth', critical: true })
  })

  it('normalises a trailing slash off routePrefix', () => {
    const { remotes } = parseManifest(valid)
    expect(remotes[1]!.routePrefix).toBe('/auth')
  })

  it('drops entries missing entry or routePrefix and reports errors', () => {
    const { remotes, errors } = parseManifest({
      remotes: [
        { name: 'a', routePrefix: '/a' },
        { name: 'b', entry: 'http://x/remoteEntry.js' },
        { name: 'ok', entry: 'http://x/remoteEntry.js', routePrefix: '/ok' },
      ],
    })
    expect(remotes.map((r) => r.name)).toEqual(['ok'])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatch(/entry/)
    expect(errors[1]).toMatch(/routePrefix/)
  })

  it('drops entries with an invalid name', () => {
    const { remotes, errors } = parseManifest({
      remotes: [
        { name: 'my-remote', entry: 'http://x/remoteEntry.js', routePrefix: '/m' },
        { name: '1abc', entry: 'http://x/remoteEntry.js', routePrefix: '/n' },
      ],
    })
    expect(remotes).toEqual([])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatch(/name/)
  })

  it('drops entries whose routePrefix does not start with / or is the root', () => {
    const { remotes, errors } = parseManifest({
      remotes: [
        { name: 'a', entry: 'http://x/remoteEntry.js', routePrefix: 'a' },
        { name: 'b', entry: 'http://x/remoteEntry.js', routePrefix: '/' },
      ],
    })
    expect(remotes).toEqual([])
    expect(errors).toHaveLength(2)
  })

  it('drops non-object entries', () => {
    const { remotes, errors } = parseManifest({ remotes: [null, 'x', 42] })
    expect(remotes).toEqual([])
    expect(errors).toHaveLength(3)
  })

  it.each([null, undefined, 'str', 42, [], {}, { remotes: 'nope' }])('non-manifest input %j → remotes: []', (input) => {
    const { remotes, errors } = parseManifest(input)
    expect(remotes).toEqual([])
    expect(errors.length).toBe(1)
  })
})

describe('loadManifest', () => {
  it('accepts an inline manifest object', async () => {
    const { remotes, errors } = await loadManifest(valid)
    expect(remotes).toHaveLength(2)
    expect(errors).toEqual([])
  })

  it('accepts an async function', async () => {
    const { remotes } = await loadManifest(async () => valid)
    expect(remotes).toHaveLength(2)
  })

  it('reports a throwing function without rejecting', async () => {
    const r = await loadManifest(async () => {
      throw new Error('boom')
    })
    expect(r.remotes).toEqual([])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/boom/)
  })

  it('fetches a URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(valid), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { remotes, errors } = await loadManifest('http://x/remotes.json')
    expect(fetchMock).toHaveBeenCalledWith('http://x/remotes.json', expect.anything())
    expect(remotes).toHaveLength(2)
    expect(errors).toEqual([])
  })

  it('fetch 404 → no throw, one error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    const r = await loadManifest('http://x/remotes.json')
    expect(r.remotes).toEqual([])
    expect(r.errors.length).toBe(1)
    expect(r.errors[0]).toMatch(/404/)
  })

  it('broken JSON → no throw, one error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{ not json', { status: 200 })))
    const r = await loadManifest('http://x/remotes.json')
    expect(r.remotes).toEqual([])
    expect(r.errors.length).toBe(1)
  })

  it('network failure → no throw, one error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const r = await loadManifest('http://x/remotes.json')
    expect(r.remotes).toEqual([])
    expect(r.errors.length).toBe(1)
  })
})
