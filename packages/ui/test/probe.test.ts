import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { Avatar, AvatarFallback, Button, Checkbox, Switch, Textarea } from '../src'

const here = dirname(fileURLToPath(import.meta.url))
const hasDist = existsSync(resolve(here, '../dist/index.js'))

describe('component probes', () => {
  it('Button renders every variant and size', () => {
    for (const variant of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const) {
      for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
        const w = mount(Button, { props: { variant, size }, slots: { default: 'x' } })
        expect(w.element.tagName).toBe('BUTTON')
        expect(w.classes().length).toBeGreaterThan(3)
      }
    }
    expect(mount(Button, { props: { variant: 'destructive' } }).classes()).toContain('bg-destructive')
    expect(mount(Button, { props: { size: 'icon' } }).classes()).toContain('size-9')
  })
  it('Button as-child passes attrs and class to the child', () => {
    const w = mount(Button, {
      props: { asChild: true },
      attrs: { class: 'extra', 'data-x': '1' },
      slots: { default: () => h('a', { href: '/x' }, 'l') },
    })
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('href')).toBe('/x')
    expect(w.attributes('data-x')).toBe('1')
    expect(w.classes()).toContain('extra')
  })
  it('class override removes the conflicting default', () => {
    const w = mount(Button, { attrs: { class: 'bg-red-500' } })
    expect(w.classes()).toContain('bg-red-500')
    expect(w.classes()).not.toContain('bg-primary')
  })
  it('Checkbox and Switch v-model', async () => {
    for (const C of [Checkbox, Switch]) {
      const v = ref(false)
      const Host = defineComponent({
        setup: () => () => h(C as never, { modelValue: v.value, 'onUpdate:modelValue': (x: boolean) => (v.value = x) }),
      })
      const w = mount(Host)
      await w.find('button').trigger('click')
      expect(v.value).toBe(true)
      await nextTick()
      expect(w.find('button').attributes('data-state')).toBe('checked')
    }
  })
  it('Textarea v-model', async () => {
    const v = ref('a')
    const Host = defineComponent({
      setup: () => () => h(Textarea, { modelValue: v.value, 'onUpdate:modelValue': (x: string | number) => (v.value = String(x)) }),
    })
    const w = mount(Host)
    expect(w.find('textarea').element.value).toBe('a')
    await w.find('textarea').setValue('b')
    expect(v.value).toBe('b')
  })
  it('Avatar shows fallback when no image', () => {
    const w = mount(Avatar, { slots: { default: () => h(AvatarFallback, null, () => 'AB') } })
    expect(w.text()).toBe('AB')
  })
})

describe.skipIf(!hasDist)('package exports (dist)', () => {
  it('dist exposes the public API', async () => {
    const m = await import(/* @vite-ignore */ '@nineh-fe-base/ui')
    for (const k of ['cn', 'buttonVariants', 'badgeVariants', 'Button', 'Badge', 'Card', 'Input', 'Label', 'Textarea', 'Checkbox', 'Switch', 'Avatar', 'Separator', 'Skeleton']) {
      expect(m, k).toHaveProperty(k)
    }
  })
  it('styles subpath resolves', () => {
    const p = import.meta.resolve?.('@nineh-fe-base/ui/styles/host.css')
    expect(p ?? '').toMatch(/styles\/host\.css$/)
  })
})
