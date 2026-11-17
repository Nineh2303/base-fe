import { describe, expect, it } from 'vitest'
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
  it('forwards props the caller passes', () => {
    const w = mount({ render: () => h(Toaster, { richColors: true, position: 'top-center' }) }, { attachTo: document.body })
    const passed = w.findComponent(Sonner).vm.$.vnode.props ?? {}
    expect(passed.richColors).toBe(true)
    expect(passed.position).toBe('top-center')
    w.unmount()
  })
})
