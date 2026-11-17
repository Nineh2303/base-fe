import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { RemoteBoundary } from '@nineh2303/mf-core'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '../src'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// jsdom lacks these, used by reka's select/menu focus + scroll code.
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.setPointerCapture ??= () => {}

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((c) => c())
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})
const flush = async () => {
  for (let i = 0; i < 6; i++) await nextTick()
}
async function mountApp(render: () => unknown) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render: render as () => never })
  app.mount(el)
  cleanups.push(() => app.unmount())
  await flush()
  return el
}
const boundary = (child: () => unknown) => () => h(RemoteBoundary as Component, { name: 'orders' }, { default: child })
const s = (v: unknown) => ({ default: () => v })
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

describe('Dialog parts', () => {
  const view = (open: boolean | undefined, extra: Record<string, unknown> = {}, onUpdate?: (v: boolean) => void) => () =>
    h(Dialog, { open, 'onUpdate:open': onUpdate, ...extra }, s([
      h(DialogTrigger, { 'data-t': 'trigger', class: 'tc' }, s('open')),
      h(DialogContent, { class: 'my-content', 'data-t': 'content' }, s([
        h(DialogHeader, { class: 'hc', id: 'hid' }, s([h(DialogTitle, { class: 'tc2' }, s('Title')), h(DialogDescription, { class: 'dc' }, s('Desc'))])),
        h(DialogFooter, { class: 'fc' }, s(h(DialogClose, { 'data-t': 'close', class: 'cc' }, s('Cancel')))),
      ])),
    ]))

  it('parts render with data-slots, forward class and attrs, and keep defaults when merged', async () => {
    await mountApp(view(true))
    const q = (sel: string) => document.body.querySelector(sel)!
    expect(q('[data-slot=dialog-header]').classList.contains('hc')).toBe(true)
    expect(q('[data-slot=dialog-header]').id).toBe('hid')
    expect(q('[data-slot=dialog-header]').className).toContain('flex-col')
    expect(q('[data-slot=dialog-footer]').classList.contains('fc')).toBe(true)
    expect(q('[data-slot=dialog-title]').textContent).toBe('Title')
    expect(q('[data-slot=dialog-title]').classList.contains('tc2')).toBe(true)
    expect(q('[data-slot=dialog-description]').textContent).toBe('Desc')
    expect(q('[data-slot=dialog-description]').classList.contains('dc')).toBe(true)
    expect(q('[data-slot=dialog-close]').getAttribute('data-t')).toBe('close')
    expect(q('[data-slot=dialog-trigger]').getAttribute('data-t')).toBe('trigger')
    const content = q('[data-slot=dialog-content]')
    expect(content.classList.contains('my-content')).toBe(true)
    expect(content.getAttribute('data-t')).toBe('content')
    expect(content.getAttribute('aria-labelledby')).toBe(q('[data-slot=dialog-title]').id)
    expect(content.getAttribute('aria-describedby')).toBe(q('[data-slot=dialog-description]').id)
  })

  it('caller class wins over conflicting default on DialogContent', async () => {
    await mountApp(() => h(Dialog, { open: true }, s(h(DialogContent, { class: 'max-w-sm p-2' }, s([h(DialogTitle, null, s('t')), h(DialogDescription, null, s('d'))])))))
    const c = document.body.querySelector('[data-slot=dialog-content]')!
    expect(c.classList.contains('max-w-sm')).toBe(true)
    expect(c.classList.contains('p-2')).toBe(true)
    expect(c.classList.contains('p-6')).toBe(false)
  })

  it('trigger click opens, close part closes, and update:open is emitted', async () => {
    const seen: boolean[] = []
    const open = ref(false)
    await mountApp(() => view(open.value, {}, (v) => { seen.push(v); open.value = v })())
    expect(document.body.querySelector('[data-slot=dialog-content]')).toBeNull()
    ;(document.body.querySelector('[data-slot=dialog-trigger]') as HTMLElement).click()
    await flush()
    expect(seen).toEqual([true])
    expect(document.body.querySelector('[data-slot=dialog-content]')).toBeTruthy()
    ;(document.body.querySelector('[data-slot=dialog-close]') as HTMLElement).click()
    await flush()
    expect(seen).toEqual([true, false])
    expect(document.body.querySelector('[data-slot=dialog-content]')).toBeNull()
  })

  it('the built-in X close button closes the dialog', async () => {
    const open = ref(true)
    await mountApp(() => view(open.value, {}, (v) => (open.value = v))())
    ;(document.body.querySelector('[data-slot=dialog-close-icon]') as HTMLElement).click()
    await flush()
    expect(open.value).toBe(false)
  })

  it('Escape closes a controlled dialog', async () => {
    const open = ref(true)
    await mountApp(() => view(open.value, {}, (v) => (open.value = v))())
    key(document.body.querySelector('[data-slot=dialog-content]')!, 'Escape')
    await flush()
    expect(open.value).toBe(false)
  })

  it('is modal by default (omitted boolean prop is not cast to false)', async () => {
    await mountApp(view(true))
    expect(document.body.style.pointerEvents).toBe('none')
  })
})

describe('DropdownMenu parts', () => {
  const tree = (state: { checked: boolean; radio: string; log: string[] }) => () =>
    h(DropdownMenu, { open: true, modal: false }, s([
      h(DropdownMenuTrigger, null, s('m')),
      h(DropdownMenuContent, { class: 'cc', 'data-t': 'dm' }, s([
        h(DropdownMenuLabel, { class: 'lc', inset: true }, s('Label')),
        h(DropdownMenuSeparator, { class: 'sc' }),
        h(DropdownMenuGroup, { class: 'gc' }, s([
          h(DropdownMenuItem, { class: 'ic', variant: 'destructive', inset: true, onSelect: () => state.log.push('item') }, s(['Item', h(DropdownMenuShortcut, { class: 'shc' }, s('K'))])),
          h(DropdownMenuItem, { disabled: true, 'data-t': 'dis', onSelect: () => state.log.push('disabled') }, s('Off')),
        ])),
        h(DropdownMenuCheckboxItem, { modelValue: state.checked, 'onUpdate:modelValue': (v: boolean | 'indeterminate') => (state.checked = v === true), class: 'cbc' }, s('Check')),
        h(DropdownMenuRadioGroup, { modelValue: state.radio, 'onUpdate:modelValue': (v: string) => (state.radio = v) }, s([
          h(DropdownMenuRadioItem, { value: 'a', class: 'rc' }, s('A')),
          h(DropdownMenuRadioItem, { value: 'b' }, s('B')),
        ])),
        h(DropdownMenuSub, null, s([
          h(DropdownMenuSubTrigger, { class: 'stc', inset: true }, s('More')),
          h(DropdownMenuSubContent, { class: 'scc', 'data-t': 'sub' }, s(h(DropdownMenuItem, { 'data-t': 'subitem' }, s('Sub item')))),
        ])),
      ])),
    ]))

  it('renders every part with its data-slot and merged class/attrs', async () => {
    await mountApp(tree({ checked: false, radio: 'a', log: [] }))
    const q = (sel: string) => document.body.querySelector(sel) as HTMLElement
    // reka ignores a forced-open sub on first render, so open it the way a user does.
    const subTrigger = q('[data-slot=dropdown-menu-sub-trigger]')
    subTrigger.focus()
    key(subTrigger, 'ArrowRight')
    await flush()
    expect(q('[data-slot=dropdown-menu-content]').classList.contains('cc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-content]').getAttribute('data-t')).toBe('dm')
    expect(q('[data-slot=dropdown-menu-label]').classList.contains('lc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-label]').hasAttribute('data-inset')).toBe(true)
    expect(q('[data-slot=dropdown-menu-separator]').classList.contains('sc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-separator]').className).toContain('bg-border')
    expect(q('[data-slot=dropdown-menu-group]').classList.contains('gc')).toBe(true)
    const item = q('[data-slot=dropdown-menu-item]')
    expect(item.classList.contains('ic')).toBe(true)
    expect(item.getAttribute('data-variant')).toBe('destructive')
    expect(item.hasAttribute('data-inset')).toBe(true)
    expect(q('[data-slot=dropdown-menu-shortcut]').classList.contains('shc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-shortcut]').textContent).toBe('K')
    expect(q('[data-slot=dropdown-menu-checkbox-item]').classList.contains('cbc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-radio-item]').classList.contains('rc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-sub-trigger]').classList.contains('stc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-sub-trigger]').hasAttribute('data-inset')).toBe(true)
    expect(q('[data-slot=dropdown-menu-sub-content]').classList.contains('scc')).toBe(true)
    expect(q('[data-slot=dropdown-menu-sub-content]').getAttribute('data-t')).toBe('sub')
  })

  it('item select emits, disabled item does not', async () => {
    const st = { checked: false, radio: 'a', log: [] as string[] }
    await mountApp(tree(st))
    const items = document.body.querySelectorAll('[data-slot=dropdown-menu-item]')
    ;(items[0] as HTMLElement).click()
    await flush()
    expect(st.log).toEqual(['item'])
    const dis = document.body.querySelector('[data-t=dis]') as HTMLElement
    expect(dis.hasAttribute('data-disabled')).toBe(true)
    expect(dis.getAttribute('aria-disabled')).toBe('true')
    dis.click()
    await flush()
    expect(st.log).toEqual(['item'])
  })

  it('checkbox item v-model toggles', async () => {
    const st = { checked: false, radio: 'a', log: [] as string[] }
    await mountApp(() => tree(st)())
    const cb = () => document.body.querySelector('[data-slot=dropdown-menu-checkbox-item]') as HTMLElement
    expect(cb().getAttribute('role')).toBe('menuitemcheckbox')
    expect(cb().getAttribute('aria-checked')).toBe('false')
    cb().click()
    await flush()
    expect(st.checked).toBe(true)
  })

  it('radio group v-model selects', async () => {
    const st = { checked: false, radio: 'a', log: [] as string[] }
    await mountApp(tree(st))
    const radios = document.body.querySelectorAll('[data-slot=dropdown-menu-radio-item]')
    expect(radios[0].getAttribute('role')).toBe('menuitemradio')
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    expect(radios[1].getAttribute('aria-checked')).toBe('false')
    ;(radios[1] as HTMLElement).click()
    await flush()
    expect(st.radio).toBe('b')
  })

  it('sub-menu opens from the sub-trigger with ArrowRight and teleports into the scope', async () => {
    const el = await mountApp(boundary(tree({ checked: false, radio: 'a', log: [] })))
    const portal = el.querySelector('[data-mf-portal]')!
    expect(document.body.querySelector('[data-slot=dropdown-menu-sub-content]')).toBeNull()
    const trig = document.body.querySelector('[data-slot=dropdown-menu-sub-trigger]') as HTMLElement
    trig.focus()
    key(trig, 'ArrowRight')
    await flush()
    const sub = document.body.querySelector('[data-slot=dropdown-menu-sub-content]')
    expect(sub).toBeTruthy()
    expect(portal.contains(sub)).toBe(true)
  })

  it('Escape closes an open menu (update:open)', async () => {
    const open = ref(true)
    await mountApp(() =>
      h(DropdownMenu, { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v) }, s([
        h(DropdownMenuTrigger, null, s('m')),
        h(DropdownMenuContent, null, s(h(DropdownMenuItem, null, s('i')))),
      ])),
    )
    const content = document.body.querySelector('[data-slot=dropdown-menu-content]')!
    key(content, 'Escape')
    await flush()
    expect(open.value).toBe(false)
  })

  it('ArrowDown on the trigger opens the menu and Enter on an item selects it', async () => {
    const log: string[] = []
    await mountApp(() =>
      h(DropdownMenu, null, s([
        h(DropdownMenuTrigger, { 'data-t': 't' }, s('m')),
        h(DropdownMenuContent, null, s(h(DropdownMenuItem, { onSelect: () => log.push('x') }, s('i')))),
      ])),
    )
    const t = document.body.querySelector('[data-t=t]') as HTMLElement
    t.focus()
    key(t, 'ArrowDown')
    await flush()
    const item = document.body.querySelector('[data-slot=dropdown-menu-item]') as HTMLElement
    expect(item).toBeTruthy()
    item.focus()
    key(item, 'Enter')
    await flush()
    expect(log).toEqual(['x'])
  })
})

describe('Select parts', () => {
  const view = (value: { v?: string }, extra: Record<string, unknown> = {}) => () =>
    h(Select, { modelValue: value.v, 'onUpdate:modelValue': (x: unknown) => (value.v = x as string), open: true, ...extra }, s([
      h(SelectTrigger, { class: 'tc', 'data-t': 'trig', size: 'sm' }, s(h(SelectValue, { placeholder: 'pick' }))),
      h(SelectContent, { class: 'cc', 'data-t': 'content' }, s(
        h(SelectGroup, { class: 'gc' }, s([
          h(SelectLabel, { class: 'lc' }, s('Fruits')),
          h(SelectItem, { value: 'a', class: 'ic' }, s('Apple')),
          h(SelectSeparator, { class: 'sc' }),
          h(SelectItem, { value: 'b', disabled: true }, s('Banana')),
          h(SelectItem, { value: 'c' }, s('Cherry')),
        ])),
      )),
    ]))

  it('renders group/label/separator with classes, attrs and aria', async () => {
    await mountApp(view({}))
    const q = (sel: string) => document.body.querySelector(sel) as HTMLElement
    expect(q('[data-slot=select-trigger]').classList.contains('tc')).toBe(true)
    expect(q('[data-slot=select-trigger]').getAttribute('data-size')).toBe('sm')
    expect(q('[data-slot=select-trigger]').getAttribute('data-t')).toBe('trig')
    expect(q('[data-slot=select-trigger]').getAttribute('role')).toBe('combobox')
    expect(q('[data-slot=select-content]').classList.contains('cc')).toBe(true)
    expect(q('[data-slot=select-content]').getAttribute('data-t')).toBe('content')
    expect(q('[data-slot=select-group]').classList.contains('gc')).toBe(true)
    expect(q('[data-slot=select-label]').classList.contains('lc')).toBe(true)
    expect(q('[data-slot=select-label]').textContent).toBe('Fruits')
    expect(q('[data-slot=select-separator]').classList.contains('sc')).toBe(true)
    expect(q('[data-slot=select-separator]').className).toContain('bg-border')
    expect(q('[data-slot=select-item]').classList.contains('ic')).toBe(true)
    expect(q('[data-slot=select-item]').getAttribute('role')).toBe('option')
  })

  it('placeholder shows when empty; selecting updates v-model; disabled item cannot be selected', async () => {
    const val: { v?: string } = {}
    const open = ref(true)
    await mountApp(() => view(val, { open: open.value, 'onUpdate:open': (o: boolean) => (open.value = o) })())
    expect(document.body.querySelector('[data-slot=select-value]')!.textContent).toBe('pick')
    const items = document.body.querySelectorAll('[data-slot=select-item]')
    const banana = items[1] as HTMLElement
    expect(banana.hasAttribute('data-disabled')).toBe(true)
    expect(banana.getAttribute('aria-disabled')).toBe('true')
    banana.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    banana.click()
    await flush()
    expect(val.v).toBeUndefined()
    const cherry = items[2] as HTMLElement
    cherry.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    cherry.click()
    await flush()
    expect(val.v).toBe('c')
  })

  it('a disabled trigger is disabled', async () => {
    await mountApp(() => h(Select, null, s(h(SelectTrigger, { disabled: true }, s(h(SelectValue))))))
    const t = document.body.querySelector('[data-slot=select-trigger]') as HTMLButtonElement
    expect(t.disabled).toBe(true)
    expect(t.hasAttribute('data-disabled')).toBe(true)
  })
})
