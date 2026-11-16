import { describe, it, expect, vi } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import { createHttpClient } from '../src/http/createHttpClient'
import type { HttpAuthHooks } from '../src/http/createHttpClient'

function setup(over: Partial<HttpAuthHooks> = {}) {
  let token: string | null = 'old'
  const auth: HttpAuthHooks = {
    getAccessToken: () => token,
    refresh: vi.fn(async () => {
      token = 'new'
      return true
    }),
    onAuthFailure: vi.fn(),
    ...over,
  }
  const http = createHttpClient({ baseURL: 'http://x', auth })
  const mock = new MockAdapter(http)
  return { http, mock, auth, setToken: (t: string | null) => (token = t) }
}

describe('createHttpClient', () => {
  it('attaches bearer token; skips on null or skipAuth', async () => {
    const { http, mock, setToken } = setup()
    mock.onGet('/a').reply((c) => [200, c.headers?.Authorization ?? null])
    expect((await http.get('/a')).data).toBe('Bearer old')
    expect((await http.get('/a', { skipAuth: true })).data).toBeNull()
    setToken(null)
    expect((await http.get('/a')).data).toBeNull()
  })

  it('401 -> refresh once -> retry with new token', async () => {
    const { http, mock, auth } = setup()
    mock.onGet('/a').reply((c) => (c.headers?.Authorization === 'Bearer new' ? [200, 'ok'] : [401]))
    const r = await http.get('/a')
    expect(r.data).toBe('ok')
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  it('3 parallel 401s -> single refresh, all succeed', async () => {
    const { http, mock, auth } = setup()
    mock.onGet('/a').reply((c) => (c.headers?.Authorization === 'Bearer new' ? [200, 'ok'] : [401]))
    const rs = await Promise.all([http.get('/a'), http.get('/a'), http.get('/a')])
    expect(rs.map((r) => r.data)).toEqual(['ok', 'ok', 'ok'])
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  for (const mode of ['false', 'throw'] as const) {
    it(`refresh ${mode} -> onAuthFailure once, all reject 401`, async () => {
      const { http, mock, auth } = setup({
        refresh: vi.fn(async () => {
          if (mode === 'throw') throw new Error('boom')
          return false
        }),
      })
      mock.onGet('/a').reply(401)
      const rs = await Promise.allSettled([http.get('/a'), http.get('/a'), http.get('/a')])
      expect(rs.every((r) => r.status === 'rejected')).toBe(true)
      for (const r of rs as PromiseRejectedResult[]) expect(r.reason.response.status).toBe(401)
      expect(auth.onAuthFailure).toHaveBeenCalledTimes(1)
    })
  }

  it('retried request still 401 -> no second refresh', async () => {
    const { http, mock, auth } = setup()
    mock.onGet('/a').reply(401)
    await expect(http.get('/a')).rejects.toMatchObject({ response: { status: 401 } })
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  it('no auth hook -> 401 rejects directly', async () => {
    const http = createHttpClient({ baseURL: 'http://x' })
    const mock = new MockAdapter(http)
    mock.onGet('/a').reply(401)
    await expect(http.get('/a')).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('sets withCredentials on the instance', () => {
    const http = createHttpClient({ withCredentials: true })
    expect(http.defaults.withCredentials).toBe(true)
  })
})
