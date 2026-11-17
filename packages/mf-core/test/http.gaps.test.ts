import { describe, it, expect, afterEach, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { createHttpClient } from '../src/http/createHttpClient'

const hooks = () => ({
  getAccessToken: vi.fn(() => 'T'),
  refresh: vi.fn(async () => true),
  onAuthFailure: vi.fn(),
})

function auth(client: ReturnType<typeof createHttpClient>, url: string, cfg: Record<string, unknown> = {}) {
  return client.get(url, cfg).then(
    (r) => r.config.headers.get('Authorization') as string | undefined,
    (e) => e,
  )
}

describe('createHttpClient trustedOrigins edge cases', () => {
  let mock: MockAdapter
  let client: ReturnType<typeof createHttpClient>
  const make = (opts: Parameters<typeof createHttpClient>[0]) => {
    client = createHttpClient(opts)
    mock = new MockAdapter(client)
    mock.onAny().reply(200, {})
    return client
  }
  afterEach(() => mock?.restore())

  it('same host but different port is a different origin (no token)', async () => {
    make({ baseURL: 'https://api.test:8443', auth: hooks() })
    expect(await auth(client, 'https://api.test:9443/x')).toBeUndefined()
    expect(await auth(client, 'https://api.test:8443/x')).toBe('Bearer T')
  })

  it('different scheme (http vs https) is a different origin', async () => {
    make({ baseURL: 'https://api.test', auth: hooks() })
    expect(await auth(client, 'http://api.test/x')).toBeUndefined()
  })

  it('default port is normalised (https://api.test:443 === https://api.test)', async () => {
    make({ baseURL: 'https://api.test', auth: hooks() })
    expect(await auth(client, 'https://api.test:443/x')).toBe('Bearer T')
  })

  it('relative URLs resolve against baseURL, including ../ and leading-slash forms', async () => {
    make({ baseURL: 'https://api.test/v1', auth: hooks() })
    expect(await auth(client, 'users')).toBe('Bearer T')
    expect(await auth(client, '/users')).toBe('Bearer T')
    expect(await auth(client, '../users')).toBe('Bearer T')
  })

  it('backslash host tricks (/\\evil.test) do not leak the token', async () => {
    make({ baseURL: 'https://api.test', auth: hooks() })
    expect(await auth(client, '/\\evil.test/x')).not.toBe('Bearer T')
  })

  it('a per-request baseURL override to a foreign origin is not trusted', async () => {
    make({ baseURL: 'https://api.test', auth: hooks() })
    expect(await auth(client, '/x', { baseURL: 'https://evil.test' })).toBeUndefined()
  })

  it('malformed trustedOrigins entries are ignored (no throw) and valid ones still work', async () => {
    const h = hooks()
    expect(() => createHttpClient({ baseURL: 'https://api.test', auth: h, trustedOrigins: ['', 'not a url', '://x', 'null'] })).not.toThrow()
    make({ baseURL: 'https://api.test', auth: h, trustedOrigins: ['not a url', 'https://cdn.test'] })
    expect(await auth(client, 'https://cdn.test/a')).toBe('Bearer T')
    expect(await auth(client, 'https://evil.test/a')).toBeUndefined()
  })

  it('trustedOrigins entry with a path/trailing slash trusts the whole origin only', async () => {
    make({ baseURL: 'https://api.test', auth: hooks(), trustedOrigins: ['https://cdn.test/some/path/'] })
    expect(await auth(client, 'https://cdn.test/other')).toBe('Bearer T')
    expect(await auth(client, 'https://cdn.test.evil.test/other')).toBeUndefined()
  })

  it('a malformed request URL is never trusted', async () => {
    make({ baseURL: 'https://api.test', auth: hooks() })
    expect(await auth(client, 'http://[bad')).not.toBe('Bearer T')
  })

  it('relative baseURL ("/api") resolves against the page origin', async () => {
    make({ baseURL: '/api', auth: hooks() })
    expect(await auth(client, '/users')).toBe('Bearer T')
    expect(await auth(client, `${location.origin}/other`)).toBe('Bearer T')
    expect(await auth(client, 'https://evil.test/x')).toBeUndefined()
  })

  it('a foreign-origin 401 with an untrusted per-request baseURL never refreshes', async () => {
    const h = hooks()
    make({ baseURL: 'https://api.test', auth: h })
    mock.reset()
    mock.onAny().reply(401)
    await expect(client.get('/x', { baseURL: 'https://evil.test' })).rejects.toBeTruthy()
    expect(h.refresh).not.toHaveBeenCalled()
    expect(h.onAuthFailure).not.toHaveBeenCalled()
  })
})
