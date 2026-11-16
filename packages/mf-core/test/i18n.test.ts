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
})
