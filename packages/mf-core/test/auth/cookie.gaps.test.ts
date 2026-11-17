import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { cookieAdapter } from '../../src/auth/adapters/cookie'
import { configureAuth, useAuthStore } from '../../src/auth/store'
import { createBus } from '../../src/bus/bus'

const user = { id: '1', name: 'A', permissions: ['a'] }
let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(axios)
  setActivePinia(createPinia())
})
afterEach(() => mock.restore())

describe('cookieAdapter gaps', () => {
  it('login accepts both { user } and a bare user body, posting credentials with withCredentials', async () => {
    mock.onPost('/auth/login').replyOnce(200, { user }).onPost('/auth/login').replyOnce(200, user)
    const a = cookieAdapter({ baseURL: 'http://x' })
    expect(await a.login({ u: 'a', p: 'b' })).toEqual(user)
    expect(await a.login({})).toEqual(user)
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({ u: 'a', p: 'b' })
    expect(mock.history.post[0]!.withCredentials).toBe(true)
    expect(mock.history.post[0]!.baseURL).toBe('http://x')
  })

  it('login failure rejects (401) and an empty body rejects too', async () => {
    mock.onPost('/auth/login').replyOnce(401).onPost('/auth/login').replyOnce(200, '')
    const a = cookieAdapter({ baseURL: 'http://x' })
    await expect(a.login({})).rejects.toBeTruthy()
    await expect(a.login({})).rejects.toBeTruthy()
  })

  it('logout posts to the logout endpoint with credentials and propagates failure', async () => {
    mock.onPost('/auth/logout').replyOnce(204).onPost('/auth/logout').replyOnce(500)
    const a = cookieAdapter({ baseURL: 'http://x' })
    await a.logout()
    expect(mock.history.post[0]!.withCredentials).toBe(true)
    await expect(a.logout()).rejects.toBeTruthy()
  })

  it('refresh: true on 2xx, false on 401 and on network error (never throws)', async () => {
    mock.onPost('/auth/refresh').replyOnce(204).onPost('/auth/refresh').replyOnce(401).onPost('/auth/refresh').networkErrorOnce()
    const a = cookieAdapter({ baseURL: 'http://x' })
    expect(await a.refresh()).toBe(true)
    expect(mock.history.post[0]!.withCredentials).toBe(true)
    expect(await a.refresh()).toBe(false)
    expect(await a.refresh()).toBe(false)
  })

  it('fetchUser: null on 401, on 500 and on network error', async () => {
    mock.onGet('/auth/me').replyOnce(401).onGet('/auth/me').replyOnce(500).onGet('/auth/me').networkErrorOnce()
    const a = cookieAdapter({ baseURL: 'http://x' })
    expect(await a.fetchUser()).toBeNull()
    expect(await a.fetchUser()).toBeNull()
    expect(await a.fetchUser()).toBeNull()
  })

  it('endpoint overrides are used (partial override keeps the other defaults)', async () => {
    mock.onPost('/api/signin').reply(200, user)
    mock.onGet('/api/whoami').reply(200, user)
    mock.onPost('/auth/logout').reply(200)
    const a = cookieAdapter({ baseURL: 'http://x', endpoints: { login: '/api/signin', me: '/api/whoami' } })
    await a.login({})
    expect(await a.fetchUser()).toEqual(user)
    await a.logout()
    expect(mock.history.post.map((r) => r.url)).toEqual(['/api/signin', '/auth/logout'])
  })

  it('store: cookie init with a 500 on me ends anonymous and never calls refresh', async () => {
    mock.onGet('/auth/me').reply(500)
    configureAuth(cookieAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('anonymous')
    expect(mock.history.post).toHaveLength(0)
  })
})
