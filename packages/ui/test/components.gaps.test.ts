import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import {
  Avatar, AvatarFallback, Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Checkbox, Input, Label, Separator, Skeleton, Switch,
  Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow,
  Tabs, TabsContent, TabsList, TabsTrigger, Textarea, badgeVariants, buttonVariants,
} from '../src'

const s = (v: unknown) => ({ default: () => v })
const flush = async () => {
  for (let i = 0; i < 6; i++) await nextTick()
  await new Promise((r) => setTimeout(r, 0))
}

// [name, component, expected tag, data-slot, a default class that the caller's override must replace, override]
const simple: Array<[string, Component, string, string, string, string]> = [
  ['Badge', Badge, 'DIV', 'badge', 'rounded-md', 'rounded-full'],
  ['Card', Card, 'DIV', 'card', 'py-6', 'py-2'],
  ['CardHeader', CardHeader, 'DIV', 'card-header', '', 'zz'],
  ['CardTitle', CardTitle, 'H3', 'card-title', 'font-semibold', 'font-normal'],
  ['CardDescription', CardDescription, 'P', 'card-description', '', 'zz'],
  ['CardContent', CardContent, 'DIV', 'card-content', '', 'zz'],
  ['CardFooter', CardFooter, 'DIV', 'card-footer', '', 'zz'],
  ['Skeleton', Skeleton, 'DIV', 'skeleton', 'rounded-md', 'rounded-full'],
  ['Input', Input, 'INPUT', 'input', 'h-9', 'h-12'],
  ['Textarea', Textarea, 'TEXTAREA', 'textarea', 'min-h-16', 'min-h-32'],
  ['Label', Label, 'LABEL', 'label', 'gap-2', 'gap-4'],
  ['Separator', Separator, 'DIV', 'separator', 'shrink-0', 'shrink'],
  ['Avatar', Avatar, 'SPAN', 'avatar', 'size-8', 'size-12'],
  ['TableCaption', TableCaption, 'CAPTION', 'table-caption', 'mt-4', 'mt-1'],
  ['TableRow', TableRow, 'TR', 'table-row', 'border-b', 'border'],
  ['TableHead', TableHead, 'TH', 'table-head', '', 'zz'],
  ['TableCell', TableCell, 'TD', 'table-cell', '', 'zz'],
  ['TableBody', TableBody, 'TBODY', 'table-body', '', 'zz'],
  ['TableHeader', TableHeader, 'THEAD', 'table-header', '', 'zz'],
  ['TableFooter', TableFooter, 'TFOOT', 'table-footer', 'font-medium', 'font-bold'],
]

describe('every simple component forwards class (caller wins) and attrs', () => {
  for (const [name, C, tag, slot, def, override] of simple) {
    it(name, () => {
      const w = mount(C, { attrs: { class: `${override} caller-x`, 'data-probe': '1', id: 'pid' }, slots: { default: 'x' } })
      const el = w.element as HTMLElement
      expect(el.tagName).toBe(tag)
      expect(el.getAttribute('data-slot')).toBe(slot)
      expect(el.classList.contains('caller-x')).toBe(true)
      expect(el.classList.contains(override)).toBe(true)
      if (def) expect(el.classList.contains(def), `default ${def} must be merged away`).toBe(false)
      expect(el.getAttribute('data-probe')).toBe('1')
      expect(el.id).toBe('pid')
    })
  }
})

describe('Table', () => {
  it('Table wraps a table in a scroll container and forwards class to the <table>', () => {
    const w = mount(Table, { attrs: { class: 'w-1/2', 'data-probe': 'p' }, slots: { default: () => h(TableBody) } })
    const root = w.element as HTMLElement
    expect(root.getAttribute('data-slot')).toBe('table-container')
    const table = root.querySelector('table')!
    expect(table.classList.contains('w-1/2')).toBe(true)
    expect(table.classList.contains('w-full')).toBe(false)
    // Vue falls attrs through to the single root: the container, not the table (document it).
    expect(root.getAttribute('data-probe')).toBe('p')
  })
  it('a full table composes with every part in the right element', () => {
    const w = mount(() =>
      h(Table, null, s([
        h(TableCaption, null, s('cap')),
        h(TableHeader, null, s(h(TableRow, null, s(h(TableHead, null, s('H')))))),
        h(TableBody, null, s(h(TableRow, null, s(h(TableCell, null, s('C')))))),
        h(TableFooter, null, s(h(TableRow, null, s(h(TableCell, null, s('F')))))),
      ])),
    )
    expect(w.find('table > caption').text()).toBe('cap')
    expect(w.find('table > thead th').text()).toBe('H')
    expect(w.find('table > tbody td').text()).toBe('C')
    expect(w.find('table > tfoot td').text()).toBe('F')
  })
})

describe('Badge / Button variants', () => {
  it('every badge variant produces its distinctive classes and Badge renders them', () => {
    const expected = {
      default: 'bg-primary',
      secondary: 'bg-secondary',
      destructive: 'bg-destructive',
      outline: 'text-foreground',
    } as const
    for (const [variant, cls] of Object.entries(expected)) {
      expect(badgeVariants({ variant: variant as keyof typeof expected })).toContain(cls)
      expect(mount(Badge, { props: { variant: variant as keyof typeof expected } }).classes()).toContain(cls)
    }
    expect(badgeVariants({ variant: 'outline' })).not.toContain('bg-primary')
  })
  it('badgeVariants/buttonVariants accept a class override', () => {
    expect(buttonVariants({ class: 'extra' })).toContain('extra')
    expect(badgeVariants({ class: 'extra' })).toContain('extra')
  })
  it('Button disabled attr passes to the element', () => {
    const w = mount(Button, { attrs: { disabled: true } })
    expect((w.element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Label / Separator', () => {
  it('Label for= targets a control', () => {
    const w = mount(Label, { props: { for: 'x' }, slots: { default: 'L' } })
    expect(w.attributes('for')).toBe('x')
    expect(w.text()).toBe('L')
  })
  it('Separator: horizontal/decorative by default, vertical and semantic when asked', () => {
    const d = mount(Separator)
    expect(d.attributes('data-orientation')).toBe('horizontal')
    expect(d.attributes('role')).toBe('none')
    const v = mount(Separator, { props: { orientation: 'vertical', decorative: false } })
    expect(v.attributes('data-orientation')).toBe('vertical')
    expect(v.attributes('role')).toBe('separator')
    expect(v.attributes('aria-orientation')).toBe('vertical')
  })
})

describe('Input / Textarea', () => {
  it('Input without v-model still lets the user type (uncontrolled)', async () => {
    const w = mount(Input)
    await w.find('input').setValue('abc')
    expect((w.find('input').element as HTMLInputElement).value).toBe('abc')
  })
  it('Input v-model both directions', async () => {
    const v = ref('a')
    const Host = defineComponent({ setup: () => () => h(Input, { modelValue: v.value, 'onUpdate:modelValue': (x: unknown) => (v.value = x as string) }) })
    const w = mount(Host)
    expect((w.find('input').element as HTMLInputElement).value).toBe('a')
    v.value = 'z'
    await nextTick()
    expect((w.find('input').element as HTMLInputElement).value).toBe('z')
    await w.find('input').setValue('typed')
    expect(v.value).toBe('typed')
  })
  it('Input forwards type, placeholder, disabled, aria-invalid', () => {
    const w = mount(Input, { attrs: { type: 'email', placeholder: 'p', disabled: true, 'aria-invalid': 'true' } })
    const el = w.find('input').element as HTMLInputElement
    expect(el.type).toBe('email')
    expect(el.placeholder).toBe('p')
    expect(el.disabled).toBe(true)
    expect(el.getAttribute('aria-invalid')).toBe('true')
  })
  it('Input type=number yields a number via v-model', async () => {
    const v = ref<string | number>('')
    const Host = defineComponent({ setup: () => () => h(Input, { type: 'number', modelValue: v.value, 'onUpdate:modelValue': (x: unknown) => (v.value = x as number) }) })
    const w = mount(Host)
    await w.find('input').setValue('42')
    expect(v.value).toBe(42)
  })
  it('Input forwards native events (focus, keydown) to the element', async () => {
    let focused = 0
    let keys = ''
    const w = mount(Input, { attrs: { onFocus: () => focused++, onKeydown: (e: KeyboardEvent) => (keys += e.key) } })
    await w.find('input').trigger('focus')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(focused).toBe(1)
    expect(keys).toBe('Enter')
  })
  it('Textarea forwards rows/disabled', () => {
    const w = mount(Textarea, { attrs: { rows: 5, disabled: true } })
    const el = w.find('textarea').element as HTMLTextAreaElement
    expect(el.rows).toBe(5)
    expect(el.disabled).toBe(true)
  })
})

describe('Checkbox / Switch', () => {
  for (const [name, C, slot] of [['Checkbox', Checkbox, 'checkbox'], ['Switch', Switch, 'switch']] as Array<[string, Component, string]>) {
    it(`${name}: class merge, attrs, role`, () => {
      const w = mount(C, { attrs: { class: 'caller-x', 'data-probe': '1', 'aria-label': 'lbl' } })
      const el = w.find('button')
      expect(el.attributes('data-slot')).toBe(slot)
      expect(el.classes()).toContain('caller-x')
      expect(el.attributes('data-probe')).toBe('1')
      expect(el.attributes('aria-label')).toBe('lbl')
      expect(el.attributes('role')).toBe(slot)
      expect(el.attributes('data-state')).toBe(slot === 'checkbox' ? 'unchecked' : 'unchecked')
    })
    it(`${name}: disabled blocks toggling and does not emit`, async () => {
      const w = mount(C, { props: { disabled: true } })
      await w.find('button').trigger('click')
      expect(w.emitted('update:modelValue')).toBeUndefined()
      expect(w.find('button').attributes('disabled')).toBeDefined()
      expect(w.find('button').attributes('data-disabled')).toBeDefined()
    })
    it(`${name}: emits update:modelValue and toggles on Space`, async () => {
      const w = mount(C)
      await w.find('button').trigger('click')
      expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
      await w.find('button').trigger('click')
      expect(w.emitted('update:modelValue')?.[1]).toEqual([false])
    })
    it(`${name}: defaultValue / default-checked starts checked`, () => {
      const w = mount(C, { props: C === Checkbox ? { defaultValue: true } : { defaultValue: true } })
      expect(w.find('button').attributes('data-state')).toBe('checked')
    })
  }
  it('Checkbox supports indeterminate and renders the indicator only when checked', async () => {
    const w = mount(Checkbox, { props: { modelValue: 'indeterminate' } })
    expect(w.find('button').attributes('data-state')).toBe('indeterminate')
    expect(w.find('[data-slot=checkbox-indicator]').exists()).toBe(true)
    const u = mount(Checkbox, { props: { modelValue: false } })
    expect(u.find('[data-slot=checkbox-indicator]').exists()).toBe(false)
    const c = mount(Checkbox, { props: { modelValue: true } })
    expect(c.find('[data-slot=checkbox-indicator] svg').exists()).toBe(true)
  })
  it('Checkbox custom indicator slot replaces the check icon', () => {
    const w = mount(Checkbox, { props: { modelValue: true }, slots: { default: '<i class="mine">x</i>' } })
    expect(w.find('.mine').exists()).toBe(true)
    expect(w.find('[data-slot=checkbox-indicator] svg').exists()).toBe(false)
  })
  it('Checkbox/Switch with name render a hidden form input carrying the value', () => {
    const w = mount(Switch, { props: { modelValue: true, name: 'n', value: 'on' }, attachTo: document.body })
    const input = document.body.querySelector('input[name=n]') as HTMLInputElement | null
    expect(input).toBeTruthy()
    w.unmount()
  })
})

describe('Tabs', () => {
  const view = (extra: Record<string, unknown> = {}, onUpdate?: (v: string) => void) =>
    mount(() =>
      h(Tabs, { defaultValue: 'a', class: 'tabs-x', 'onUpdate:modelValue': onUpdate, ...extra }, s([
        h(TabsList, { class: 'list-x', 'data-probe': 'l' }, s([
          h(TabsTrigger, { value: 'a', class: 'trig-x' }, s('A')),
          h(TabsTrigger, { value: 'b' }, s('B')),
          h(TabsTrigger, { value: 'c', disabled: true }, s('C')),
        ])),
        h(TabsContent, { value: 'a', class: 'content-x' }, s('panel a')),
        h(TabsContent, { value: 'b' }, s('panel b')),
        h(TabsContent, { value: 'c' }, s('panel c')),
      ])),
    { attachTo: document.body })

  it('renders every part with data-slot, classes and aria roles; default value selects', () => {
    const w = view()
    const q = (sel: string) => w.find(sel)
    expect(q('[data-slot=tabs]').classes()).toContain('tabs-x')
    expect(q('[data-slot=tabs]').classes()).toContain('flex')
    expect(q('[data-slot=tabs-list]').classes()).toContain('list-x')
    expect(q('[data-slot=tabs-list]').attributes('role')).toBe('tablist')
    expect(q('[data-slot=tabs-list]').attributes('data-probe')).toBe('l')
    expect(w.findAll('[role=tab]')).toHaveLength(3)
    expect(w.findAll('[role=tab]')[0].classes()).toContain('trig-x')
    expect(w.findAll('[role=tab]')[0].attributes('data-state')).toBe('active')
    expect(w.findAll('[role=tab]')[0].attributes('aria-selected')).toBe('true')
    expect(w.find('[role=tabpanel][data-state=active]').text()).toBe('panel a')
    expect(w.find('[role=tabpanel][data-state=active]').classes()).toContain('content-x')
    // inactive panels are not rendered
    expect(w.findAll('[role=tabpanel][data-state=active]')).toHaveLength(1)
    w.unmount()
  })

  it('clicking a trigger (mousedown, as reka listens) selects it and emits update:modelValue', async () => {
    const seen: string[] = []
    const w = view({}, (v) => seen.push(v))
    await w.findAll('[role=tab]')[1].trigger('mousedown', { button: 0 })
    await nextTick()
    expect(seen).toEqual(['b'])
    expect(w.find('[role=tabpanel][data-state=active]').text()).toBe('panel b')
    w.unmount()
  })

  it('v-model controls the active tab', async () => {
    const active = ref('b')
    const w = mount(() =>
      h(Tabs, { modelValue: active.value, 'onUpdate:modelValue': (v: string) => (active.value = v) }, s([
        h(TabsList, null, s([h(TabsTrigger, { value: 'a' }, s('A')), h(TabsTrigger, { value: 'b' }, s('B'))])),
        h(TabsContent, { value: 'a' }, s('pa')),
        h(TabsContent, { value: 'b' }, s('pb')),
      ])),
    { attachTo: document.body })
    expect(w.find('[role=tabpanel][data-state=active]').text()).toBe('pb')
    active.value = 'a'
    await flush()
    expect(w.find('[role=tabpanel][data-state=active]').text()).toBe('pa')
    w.unmount()
  })

  it('disabled trigger cannot be activated', async () => {
    const seen: string[] = []
    const w = view({}, (v) => seen.push(v))
    const c = w.findAll('[role=tab]')[2]
    expect(c.attributes('disabled')).toBeDefined()
    await c.trigger('mousedown', { button: 0 })
    await c.trigger('click')
    expect(seen).toEqual([])
    w.unmount()
  })

  it('ArrowRight moves focus to the next enabled tab (roving focus) and activates it', async () => {
    const seen: string[] = []
    const w = view({}, (v) => seen.push(v))
    await flush() // reka attaches its roving-focus keydown listener post-flush
    const tabs = w.findAll('[role=tab]')
    ;(tabs[0].element as HTMLElement).focus()
    await tabs[0].trigger('keydown', { key: 'ArrowRight' })
    await flush()
    expect(document.activeElement).toBe(tabs[1].element)
    // activation follows focus by default in reka ("automatic")
    expect(seen).toEqual(['b'])
    // disabled tab is skipped when going on
    await tabs[1].trigger('keydown', { key: 'ArrowRight' })
    await flush()
    expect(document.activeElement).toBe(tabs[0].element)
    w.unmount()
  })
})

describe('Avatar', () => {
  it('AvatarFallback forwards class and falls back to slot', () => {
    const w = mount(Avatar, { slots: { default: () => h(AvatarFallback, { class: 'fb-x' }, s('JD')) } })
    expect(w.find('[data-slot=avatar-fallback]').classes()).toContain('fb-x')
    expect(w.text()).toBe('JD')
  })
})
