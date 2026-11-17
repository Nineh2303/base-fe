import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { jwtAdapter } from '../../src/auth/adapters/jwt'
import { configureAuth, useAuthStore } from '../../src/auth/store'
import { createBus } from '../../src/bus/bus'

const user = { id: '1', name: 'A', permissions: ['x'] }
let mock: MockAdapter
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  mock = new MockAdapter(axios)
  setActivePinia(createPinia())
})
afterEach(() => {
  mock.restore()
  vi.restoreAllMocks()
})

describe('jwtAdapter gaps', () => {
  it('logout while a refresh is in flight: the late refresh response must not resurrect the session', async () => {
    localStorage.setItem('mf-refresh-token', 'RT1')
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    mock.onPost('/auth/refresh').reply(async () => {
      await gate
      return [200, { accessToken: 'AT-late', refreshToken: 'RT-late' }]
    })
    mock.onPost('/auth/logout').reply(200)
    const a = jwtAdapter({ baseURL: 'http://x' })
    configureAuth(a, createBus())
    const s = useAuthStore()
    const inflight = s.refresh()
    await s.logout()
    release()
    await inflight
    expect(a.getAccessToken()).toBeNull()
    expect(localStorage.getItem('mf-refresh-token')).toBeNull()
  })

  it('refresh 500 / network error keep the stored token (session may still be valid)', async () => {
    localStorage.setItem('mf-refresh-token', 'RT1')
    mock.onPost('/auth/refresh').replyOnce(500).onPost('/auth/refresh').networkErrorOnce()
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.refresh()).toBe(false)
    expect(await a.refresh()).toBe(false)
    expect(localStorage.getItem('mf-refresh-token')).toBe('RT1')
  })

  it('refresh keeps the existing refresh token when the response does not rotate it', async () => {
    localStorage.setItem('mf-refresh-token', 'RT1')
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'AT2' })
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.refresh()).toBe(true)
    expect(a.getAccessToken()).toBe('AT2')
    expect(localStorage.getItem('mf-refresh-token')).toBe('RT1')
  })

  it('sessionStorage kind uses sessionStorage only, with a custom storageKey', async () => {
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', refreshToken: 'RT', user })
    const a = jwtAdapter({ baseURL: 'http://x', refreshTokenStorage: 'sessionStorage', storageKey: 'k' })
    await a.login({})
    expect(sessionStorage.getItem('k')).toBe('RT')
    expect(localStorage.length).toBe(0)
  })

  it('unavailable web storage degrades to in-memory instead of throwing', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', refreshToken: 'RT', user })
    mock.onPost('/auth/refresh').reply((c) => [JSON.parse(c.data).refreshToken === 'RT' ? 200 : 401, { accessToken: 'AT2' }])
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.login({})).toEqual(user)
    expect(a.getAccessToken()).toBe('AT')
    // The refresh token survives in memory even though web storage is unusable.
    expect(await a.refresh()).toBe(true)
    expect(a.getAccessToken()).toBe('AT2')
  })

  it('login without a refreshToken works (access token only) and logout posts refreshToken null', async () => {
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', user })
    mock.onPost('/auth/logout').reply(200)
    const a = jwtAdapter({ baseURL: 'http://x' })
    await a.login({})
    expect(a.getAccessToken()).toBe('AT')
    await a.logout()
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual({ refreshToken: null })
    expect(a.getAccessToken()).toBeNull()
  })

  it('fetchUser returns null without a token (no request) and on a 401', async () => {
    mock.onGet('/auth/me').reply(401)
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.fetchUser()).toBeNull()
    expect(mock.history.get).toHaveLength(0)
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', user })
    await a.login({})
    expect(await a.fetchUser()).toBeNull()
  })

  it('custom endpoints are used for login/refresh/logout/me', async () => {
    localStorage.setItem('mf-refresh-token', 'RT1')
    mock.onPost('/v2/in').reply(200, { accessToken: 'A1', refreshToken: 'RT2', user })
    mock.onPost('/v2/rf').reply(200, { accessToken: 'A2' })
    mock.onGet('/v2/me').reply(200, user)
    mock.onPost('/v2/out').reply(200)
    const a = jwtAdapter({ baseURL: 'http://x', endpoints: { login: '/v2/in', refresh: '/v2/rf', logout: '/v2/out', me: '/v2/me' } })
    await a.login({})
    await a.refresh()
    expect(await a.fetchUser()).toEqual(user)
    await a.logout()
    expect(mock.history.post.map((r) => r.url)).toEqual(['/v2/in', '/v2/rf', '/v2/out'])
  })
})
