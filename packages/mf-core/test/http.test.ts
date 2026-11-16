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

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('createHttpClient concurrency edges', () => {
  it('request issued while refresh is in flight ends up with the new token and no extra refresh', async () => {
    const gate = deferred<boolean>()
    let token = 'old'
    const refresh = vi.fn(async () => {
      const ok = await gate.promise
      token = 'new'
      return ok
    })
    const { http, mock } = setup({ getAccessToken: () => token, refresh })
    mock.onGet('/a').reply((c) => (c.headers?.Authorization === 'Bearer new' ? [200, 'ok'] : [401]))
    const first = http.get('/a')
    await tick()
    expect(refresh).toHaveBeenCalledTimes(1)
    const second = http.get('/a') // issued mid-refresh
    await tick()
    gate.resolve(true)
    expect((await first).data).toBe('ok')
    expect((await second).data).toBe('ok')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stale-token 401 arriving after refresh settled does not trigger a second refresh', async () => {
    const { http, mock, auth } = setup()
    const slow = deferred<void>()
    mock.onGet('/slow').reply(async (c) => {
      await slow.promise
      return c.headers?.Authorization === 'Bearer new' ? [200, 'ok'] : [401]
    })
    mock.onGet('/a').reply((c) => (c.headers?.Authorization === 'Bearer new' ? [200, 'ok'] : [401]))
    const s = http.get('/slow') // sent with old token
    await http.get('/a') // refresh -> new token
    expect(auth.refresh).toHaveBeenCalledTimes(1)
    slow.resolve()
    expect((await s).data).toBe('ok')
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })

  it('after a failed cycle a later 401 starts a fresh refresh cycle', async () => {
    const refresh = vi.fn(async () => false)
    const { http, mock, auth } = setup({ refresh })
    mock.onGet('/a').reply(401)
    await expect(http.get('/a')).rejects.toMatchObject({ response: { status: 401 } })
    await expect(http.get('/a')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(auth.onAuthFailure).toHaveBeenCalledTimes(2)
  })

  it('non-401 errors and network errors pass through without refresh', async () => {
    const { http, mock, auth } = setup()
    mock.onGet('/500').reply(500)
    mock.onGet('/net').networkError()
    await expect(http.get('/500')).rejects.toMatchObject({ response: { status: 500 } })
    await expect(http.get('/net')).rejects.toMatchObject({ message: 'Network Error' })
    expect(auth.refresh).not.toHaveBeenCalled()
    expect(auth.onAuthFailure).not.toHaveBeenCalled()
  })

  it('skipAuth request that gets 401 does not refresh', async () => {
    const { http, mock, auth } = setup()
    mock.onGet('/a').reply(401)
    await expect(http.get('/a', { skipAuth: true })).rejects.toMatchObject({ response: { status: 401 } })
    expect(auth.refresh).not.toHaveBeenCalled()
  })

  for (const mode of ['throw', 'reject'] as const) {
    it(`onAuthFailure ${mode}s -> requests still settle (no hang)`, async () => {
      const onAuthFailure = vi.fn(() => {
        if (mode === 'throw') throw new Error('x')
        return Promise.reject(new Error('x'))
      })
      const { http, mock } = setup({ refresh: async () => false, onAuthFailure })
      mock.onGet('/a').reply(401)
      const rs = await Promise.race([
        Promise.allSettled([http.get('/a'), http.get('/a')]),
        new Promise<'hang'>((r) => setTimeout(() => r('hang'), 500)),
      ])
      expect(rs).not.toBe('hang')
      expect((rs as PromiseSettledResult<unknown>[]).every((r) => r.status === 'rejected')).toBe(true)
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
      // and a subsequent 401 is not stuck on a stale promise
      await expect(http.get('/a')).rejects.toBeDefined()
      expect(onAuthFailure).toHaveBeenCalledTimes(2)
    })
  }
})
