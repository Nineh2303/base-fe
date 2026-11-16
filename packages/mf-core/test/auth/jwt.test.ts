import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { jwtAdapter } from '../../src/auth/adapters/jwt'

const user = { id: '1', name: 'A', permissions: ['x'] }
let mock: MockAdapter

beforeEach(() => {
  localStorage.clear()
  mock = new MockAdapter(axios)
})
afterEach(() => mock.restore())

describe('jwtAdapter', () => {
  it('login stores refresh token in localStorage and keeps access token in memory', async () => {
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', refreshToken: 'RT', user })
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.login({ u: 1 })).toEqual(user)
    expect(localStorage.getItem('mf-refresh-token')).toBe('RT')
    expect(a.getAccessToken()).toBe('AT')
  })

  it('refresh without stored token returns false and makes no request', async () => {
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.refresh()).toBe(false)
    expect(mock.history.post).toHaveLength(0)
  })

  it('refresh 401 returns false and clears stored token', async () => {
    localStorage.setItem('mf-refresh-token', 'RT')
    mock.onPost('/auth/refresh').reply(401)
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.refresh()).toBe(false)
    expect(localStorage.getItem('mf-refresh-token')).toBeNull()
  })

  it('refresh success updates access token and rotated refresh token', async () => {
    localStorage.setItem('mf-refresh-token', 'RT')
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'AT2', refreshToken: 'RT2' })
    const a = jwtAdapter({ baseURL: 'http://x' })
    expect(await a.refresh()).toBe(true)
    expect(a.getAccessToken()).toBe('AT2')
    expect(localStorage.getItem('mf-refresh-token')).toBe('RT2')
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ refreshToken: 'RT' })
  })

  it("'memory' storage never writes localStorage", async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', refreshToken: 'RT', user })
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'AT2' })
    const a = jwtAdapter({ baseURL: 'http://x', refreshTokenStorage: 'memory' })
    await a.login({})
    expect(await a.refresh()).toBe(true)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('logout clears both tokens', async () => {
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', refreshToken: 'RT', user })
    mock.onPost('/auth/logout').reply(200)
    const a = jwtAdapter({ baseURL: 'http://x' })
    await a.login({})
    await a.logout()
    expect(a.getAccessToken()).toBeNull()
    expect(localStorage.getItem('mf-refresh-token')).toBeNull()
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ refreshToken: 'RT' })
  })

  it('fetchUser sends Bearer token', async () => {
    mock.onPost('/auth/login').reply(200, { accessToken: 'AT', refreshToken: 'RT', user })
    mock.onGet('/auth/me').reply((c) => [200, c.headers?.Authorization === 'Bearer AT' ? user : null])
    const a = jwtAdapter({ baseURL: 'http://x' })
    await a.login({})
    expect(await a.fetchUser()).toEqual(user)
  })
})
