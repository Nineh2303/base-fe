import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { Toaster as Sonner } from 'vue-sonner'
import { Toaster } from '../src'

describe('Toaster props', () => {
  it('does not forward omitted boolean props as false', () => {
    const w = mount(Toaster, { attachTo: document.body })
    const passed = w.findComponent(Sonner).vm.$.vnode.props ?? {}
    for (const k of ['expand', 'richColors', 'closeButton', 'invert']) expect(k in passed, k).toBe(false)
    w.unmount()
  })
  it('forwards props the caller passes to the rendered toaster (DOM)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mount({ render: () => h(Toaster, { richColors: true, position: 'top-center' }) }, { attachTo: document.body })
    const el = document.body.querySelector('[data-sonner-toaster]')!
    expect(el.getAttribute('data-y-position')).toBe('top')
    expect(el.getAttribute('data-x-position')).toBe('center')
    expect(el.getAttribute('data-rich-colors')).toBe('true')
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Extraneous non-props')
    warn.mockRestore()
    w.unmount()
  })
})
