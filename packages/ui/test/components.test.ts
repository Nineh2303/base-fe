import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { AvatarRoot, AvatarImage as RekaAvatarImage } from 'reka-ui'
import { AvatarImage, Button, Card, Input } from '../src'

describe('components', () => {
  it('Button merges caller class over defaults', () => {
    const w = mount(Button, { attrs: { class: 'rounded-full' }, slots: { default: 'Hi' } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.classes()).toContain('rounded-full')
    expect(w.classes()).not.toContain('rounded-md')
  })
  it('Button as-child renders the slot element', () => {
    const w = mount(Button, {
      props: { asChild: true },
      slots: { default: () => h('a', { href: '/x' }, 'link') },
    })
    expect(w.element.tagName).toBe('A')
    expect(w.classes()).toContain('bg-primary')
  })
  it('Card renders its slot', () => {
    const w = mount(Card, { slots: { default: 'body' } })
    expect(w.text()).toBe('body')
  })
  it('Input v-model round-trips', async () => {
    const value = ref('a')
    const Host = defineComponent({
      setup: () => () => h(Input, { modelValue: value.value, 'onUpdate:modelValue': (v: string | number) => (value.value = String(v)) }),
    })
    const w = mount(Host)
    const input = w.find('input')
    expect(input.element.value).toBe('a')
    await input.setValue('b')
    expect(value.value).toBe('b')
  })
})

describe('Avatar image', () => {
  it('forwards all props, not only src', () => {
    const w = mount({
      render: () => h(AvatarRoot, null, { default: () => h(AvatarImage, { src: '/a.png', crossOrigin: 'anonymous', referrerPolicy: 'no-referrer', class: 'x' }) }),
    })
    const inner = w.findComponent(RekaAvatarImage)
    expect(inner.props('src')).toBe('/a.png')
    expect(inner.props('crossOrigin')).toBe('anonymous')
    expect(inner.props('referrerPolicy')).toBe('no-referrer')
  })
})
