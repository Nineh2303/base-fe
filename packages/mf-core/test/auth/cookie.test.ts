import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { createPinia, setActivePinia } from 'pinia'
import { cookieAdapter } from '../../src/auth/adapters/cookie'
import { configureAuth, useAuthStore } from '../../src/auth/store'
import { createBus } from '../../src/bus/bus'

const user = { id: '1', name: 'A', permissions: [] }
let mock: MockAdapter
beforeEach(() => {
  mock = new MockAdapter(axios)
  setActivePinia(createPinia())
})
afterEach(() => mock.restore())

describe('cookieAdapter', () => {
  it('sends withCredentials and has no access token', async () => {
    mock.onGet('/auth/me').reply(200, user)
    const a = cookieAdapter({ baseURL: 'http://x' })
    expect(a.withCredentials).toBe(true)
    expect(a.getAccessToken()).toBeNull()
    await a.fetchUser()
    expect(mock.history.get[0].withCredentials).toBe(true)
  })

  it('init authenticates on 200 me', async () => {
    mock.onGet('/auth/me').reply(200, user)
    configureAuth(cookieAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('authenticated')
    expect(mock.history.post).toHaveLength(0)
  })

  it('init is anonymous on 401 me', async () => {
    mock.onGet('/auth/me').reply(401)
    configureAuth(cookieAdapter({ baseURL: 'http://x' }), createBus())
    const s = useAuthStore()
    await s.init()
    expect(s.status).toBe('anonymous')
  })
})
