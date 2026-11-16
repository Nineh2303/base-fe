import { describe, it, expect } from 'vitest'
import { createMfI18n, registerMessages } from '../src/i18n/i18n'

describe('i18n', () => {
  it('registers namespaced messages', () => {
    const i18n = createMfI18n()
    registerMessages(i18n, 'products', { vi: { title: 'Sản phẩm' } })
    expect(i18n.global.t('products.title')).toBe('Sản phẩm')
  })
  it('namespaces do not overwrite each other', () => {
    const i18n = createMfI18n()
    registerMessages(i18n, 'a', { vi: { title: 'A' } })
    registerMessages(i18n, 'b', { vi: { title: 'B' } })
    expect(i18n.global.t('a.title')).toBe('A')
    expect(i18n.global.t('b.title')).toBe('B')
  })
  it('registers a locale absent at creation and merges into an existing locale', () => {
    const i18n = createMfI18n({ messages: { vi: { common: { ok: 'OK' } } } })
    registerMessages(i18n, 'p', { vi: { t: 'V' }, fr: { t: 'F' } })
    expect(i18n.global.t('common.ok')).toBe('OK')
    expect(i18n.global.t('p.t')).toBe('V')
    expect(i18n.global.t('p.t', {}, { locale: 'fr' })).toBe('F')
  })
  it('falls back to en when vi key is missing', () => {
    const i18n = createMfI18n()
    registerMessages(i18n, 'p', { en: { only: 'EN' } })
    expect(i18n.global.t('p.only')).toBe('EN')
  })
})
