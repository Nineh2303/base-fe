import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createBus } from '../src/bus/bus'
import { createMockAuthAdapter } from '../src/auth/adapters/mock'
import { configureAuth, useAuthStore } from '../src/auth/store'
import { createMfI18n, registerMessages } from '../src/i18n/i18n'

describe('bus gaps', () => {
  it('a throwing listener does not stop other listeners nor throw into the emitter', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bus = createBus()
    const second = vi.fn()
    bus.on('notify', () => {
      throw new Error('remote bug')
    })
    bus.on('notify', second)
    expect(() => bus.emit('notify', { type: 'info', message: 'm' })).not.toThrow()
    expect(second).toHaveBeenCalledWith({ type: 'info', message: 'm' })
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('wildcard listeners still receive events', () => {
    const bus = createBus()
    const all = vi.fn()
    bus.on('*', all)
    bus.emit('notify', { type: 'info', message: 'm' })
    expect(all).toHaveBeenCalledWith('notify', { type: 'info', message: 'm' })
  })

  it('custom namespaced events are delivered and isolated per bus instance', () => {
    const a = createBus()
    const b = createBus()
    const h = vi.fn()
    a.on('cart:add', h)
    b.emit('cart:add', 1)
    expect(h).not.toHaveBeenCalled()
    a.emit('cart:add', 2)
    expect(h).toHaveBeenCalledWith(2)
  })

  describe('a throwing auth listener must not break login/logout', () => {
    beforeEach(() => setActivePinia(createPinia()))
    it('login resolves and the user is authenticated even if an auth:login listener throws', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      const bus = createBus()
      bus.on('auth:login', () => {
        throw new Error('boom')
      })
      configureAuth(createMockAuthAdapter(), bus)
      const s = useAuthStore()
      await expect(s.login({})).resolves.toMatchObject({ id: 'mock-1' })
      expect(s.status).toBe('authenticated')
      err.mockRestore()
    })
    it('logout resolves when an auth:logout listener throws', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      const bus = createBus()
      bus.on('auth:logout', () => {
        throw new Error('boom')
      })
      configureAuth(createMockAuthAdapter({ autoLogin: true }), bus)
      const s = useAuthStore()
      await expect(s.logout()).resolves.toBeUndefined()
      expect(s.status).toBe('anonymous')
      err.mockRestore()
    })
  })
})

describe('i18n registration collisions', () => {
  it('re-registering the same namespace merges: new keys added, existing keys overwritten', () => {
    const i18n = createMfI18n({ locale: 'en', messages: {} })
    registerMessages(i18n, 'products', { en: { a: 'A1', b: 'B1' } })
    registerMessages(i18n, 'products', { en: { a: 'A2', c: 'C2' } })
    const t = i18n.global.t as (k: string) => string
    expect(t('products.a')).toBe('A2')
    expect(t('products.b')).toBe('B1')
    expect(t('products.c')).toBe('C2')
  })

  it('a remote namespace cannot clobber a host top-level namespace', () => {
    const i18n = createMfI18n({ locale: 'en', messages: { en: { host: { title: 'Host' } } } })
    registerMessages(i18n, 'products', { en: { title: 'P' } })
    const t = i18n.global.t as (k: string) => string
    expect(t('host.title')).toBe('Host')
    expect(t('products.title')).toBe('P')
  })

  it('unknown key returns the key itself (no throw)', () => {
    const i18n = createMfI18n({ locale: 'en' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((i18n.global.t as (k: string) => string)('nope.key')).toBe('nope.key')
    warn.mockRestore()
  })
})
