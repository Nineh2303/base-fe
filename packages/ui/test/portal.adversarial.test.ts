import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { RemoteBoundary } from '@nineh-fe-base/mf-core'
import * as ui from '../src'
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Toaster, toast,
} from '../src'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((c) => c())
  document.body.innerHTML = ''
})
const flush = async () => {
  for (let i = 0; i < 8; i++) await nextTick()
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
const rb = (scope: string, child: () => unknown) =>
  h(RemoteBoundary as Component, { name: scope, scope }, { default: child })
const dlg = (props: Record<string, unknown>, tag: string) =>
  h(Dialog, props, {
    default: () =>
      h(DialogContent, { 'data-t': tag }, { default: () => [h(DialogTitle, null, { default: () => 'T' }), h(DialogDescription, null, { default: () => 'D' })] }),
  })

describe('adversarial: dialog', () => {
  it('open-at-mount keeps focus inside the content after the teleport move', async () => {
    await mountApp(() => rb('a', () => dlg({ open: true }, 'c')))
    const content = document.body.querySelector('[data-slot=dialog-content]') as HTMLElement
    expect(content.closest('[data-mf-portal]')).toBeTruthy()
    expect(content.contains(document.activeElement)).toBe(true)
  })

  it('Escape closes it and content leaves the portal (controlled)', async () => {
    const open = ref(true)
    await mountApp(() =>
      rb('a', () => h(Dialog, { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v) }, {
        default: () => h(DialogContent, null, { default: () => [h(DialogTitle, null, { default: () => 'T' }), h(DialogDescription, null, { default: () => 'D' })] }),
      })),
    )
    const content = document.body.querySelector('[data-slot=dialog-content]') as HTMLElement
    expect(content).toBeTruthy()
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(open.value).toBe(false)
    expect(document.body.querySelector('[data-slot=dialog-content]')).toBeNull()
  })

  it('two sibling boundaries each get their own dialog in their own portal', async () => {
    const el = await mountApp(() => h('div', null, [rb('a', () => dlg({ open: true }, 'A')), rb('b', () => dlg({ open: true }, 'B'))]))
    const pa = el.querySelector('[data-mf-remote=a] [data-mf-portal]')!
    const pb = el.querySelector('[data-mf-remote=b] [data-mf-portal]')!
    expect(pa).not.toBe(pb)
    expect(pa.querySelectorAll('[data-slot=dialog-content]')).toHaveLength(1)
    expect(pb.querySelectorAll('[data-slot=dialog-content]')).toHaveLength(1)
    expect(pa.querySelector('[data-t=A]')).toBeTruthy()
    expect(pb.querySelector('[data-t=B]')).toBeTruthy()
    expect(pa.querySelector('[data-t=B]')).toBeNull()
    expect(pb.querySelector('[data-t=A]')).toBeNull()
  })
})

describe('adversarial: nested boundary', () => {
  it('innermost portal wins for DropdownMenu, Select and Tooltip', async () => {
    const el = await mountApp(() =>
      rb('outer', () =>
        rb('inner', () => [
          h(DropdownMenu, { open: true, modal: false }, { default: () => [h(DropdownMenuTrigger, null, { default: () => 'x' }), h(DropdownMenuContent, null, { default: () => h(DropdownMenuItem, null, { default: () => 'i' }) })] }),
          h(Select, { open: true, defaultValue: 'a' }, { default: () => [h(SelectTrigger, null, { default: () => h(SelectValue) }), h(SelectContent, null, { default: () => h(SelectItem, { value: 'a' }, { default: () => 'A' }) })] }),
          h(TooltipProvider, null, { default: () => h(Tooltip, { open: true }, { default: () => [h(TooltipTrigger, null, { default: () => 't' }), h(TooltipContent, null, { default: () => 'tip' })] }) }),
        ]),
      ),
    )
    const inner = el.querySelector('[data-mf-remote=inner] [data-mf-portal]')!
    expect(inner).toBeTruthy()
    for (const s of ['dropdown-menu-content', 'select-content', 'tooltip-content']) {
      const c = document.body.querySelector(`[data-slot=${s}]`)!
      expect(c, s).toBeTruthy()
      expect(c.closest('[data-mf-portal]'), s).toBe(inner)
    }
  })
})

describe('adversarial: toaster', () => {
  it('toast() from inside a boundary renders the toast inside that portal', async () => {
    const el = await mountApp(() => rb('a', () => h(Toaster)))
    toast('hello-scope')
    await flush()
    const portal = el.querySelector('[data-mf-portal]')!
    expect(portal.textContent).toContain('hello-scope')
  })
  it('Toaster outside a boundary renders under body', async () => {
    const el = await mountApp(() => h(Toaster))
    toast('hello-body')
    await flush()
    const t = document.body.querySelector('[data-sonner-toaster]')
    expect(t).toBeTruthy()
    expect(document.body.querySelector('[data-mf-portal]')).toBeNull()
    expect(el.contains(t)).toBe(false)
  })
  it('two Toasters each show every toast (mount a single Toaster)', async () => {
    await mountApp(() => h('div', null, [h(Toaster), h(Toaster)]))
    toast('dup-check')
    await flush()
    const n = (document.body.textContent!.match(/dup-check/g) ?? []).length
    // vue-sonner toasters share one global store, so each mounted Toaster shows every toast.
    expect(document.body.querySelectorAll('[data-sonner-toaster]').length).toBe(2)
    expect(n).toBe(2)
  })
})

describe('adversarial: behavior', () => {
  it('Select option click updates v-model', async () => {
    const v = ref('a')
    await mountApp(() =>
      h(Select, { open: true, modelValue: v.value, 'onUpdate:modelValue': (x: unknown) => (v.value = String(x)) }, {
        default: () => [h(SelectTrigger, null, { default: () => h(SelectValue) }), h(SelectContent, null, { default: () => [h(SelectItem, { value: 'a' }, { default: () => 'A' }), h(SelectItem, { value: 'b' }, { default: () => 'B' })] })],
      }),
    )
    const items = document.body.querySelectorAll('[data-slot=select-item]')
    expect(items.length).toBe(2)
    const b = items[1] as HTMLElement
    b.focus()
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flush()
    expect(v.value).toBe('b')
  })

  it('DropdownMenu item click emits select and closes', async () => {
    const open = ref(true)
    let selected = 0
    await mountApp(() =>
      h(DropdownMenu, { open: open.value, 'onUpdate:open': (x: boolean) => (open.value = x), modal: false }, {
        default: () => [h(DropdownMenuTrigger, null, { default: () => 'x' }), h(DropdownMenuContent, null, { default: () => h(DropdownMenuItem, { onSelect: () => selected++ }, { default: () => 'i' }) })],
      }),
    )
    const item = document.body.querySelector('[data-slot=dropdown-menu-item]') as HTMLElement
    item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()
    expect(selected).toBe(1)
    expect(open.value).toBe(false)
  })

  it('Tabs switches content', async () => {
    const tab = ref('one')
    const el = await mountApp(() =>
      h(Tabs, { modelValue: tab.value, 'onUpdate:modelValue': (x: unknown) => (tab.value = String(x)) }, {
        default: () => [
          h(TabsList, null, { default: () => [h(TabsTrigger, { value: 'one' }, { default: () => '1' }), h(TabsTrigger, { value: 'two' }, { default: () => '2' })] }),
          h(TabsContent, { value: 'one' }, { default: () => 'content-one' }),
          h(TabsContent, { value: 'two' }, { default: () => 'content-two' }),
        ],
      }),
    )
    expect(el.textContent).toContain('content-one')
    expect(el.textContent).not.toContain('content-two')
    const t2 = el.querySelectorAll('[role=tab]')[1] as HTMLElement
    t2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    await flush()
    expect(tab.value).toBe('two')
    expect(el.textContent).toContain('content-two')
    expect(el.textContent).not.toContain('content-one')
  })

  it('Table renders semantic elements', async () => {
    const el = await mountApp(() =>
      h(Table, null, {
        default: () => [
          h(TableHeader, null, { default: () => h(TableRow, null, { default: () => h(TableHead, null, { default: () => 'H' }) }) }),
          h(TableBody, null, { default: () => h(TableRow, null, { default: () => h(TableCell, null, { default: () => 'C' }) }) }),
        ],
      }),
    )
    expect(el.querySelector('table > thead > tr > th')?.textContent).toBe('H')
    expect(el.querySelector('table > tbody > tr > td')?.textContent).toBe('C')
  })
})

describe('adversarial: exports', () => {
  const names = [
    'Dialog', 'DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter', 'DialogClose',
    'DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuGroup', 'DropdownMenuCheckboxItem', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem', 'DropdownMenuSub', 'DropdownMenuSubTrigger', 'DropdownMenuSubContent', 'DropdownMenuShortcut',
    'Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem', 'SelectGroup', 'SelectLabel', 'SelectSeparator',
    'Tooltip', 'TooltipTrigger', 'TooltipContent', 'TooltipProvider',
    'Tabs', 'TabsList', 'TabsTrigger', 'TabsContent',
    'Table', 'TableHeader', 'TableBody', 'TableFooter', 'TableRow', 'TableHead', 'TableCell', 'TableCaption',
    'Toaster', 'toast', 'usePortalTo',
  ]
  it('src/index exports every name', () => {
    for (const n of names) expect((ui as Record<string, unknown>)[n], n).toBeDefined()
  })
  it('dist exports every name (when built)', async () => {
    const f = resolve(__dirname, '../dist/index.js')
    if (!existsSync(f)) return
    const mod = (await import(/* @vite-ignore */ pathToFileURL(f).href)) as Record<string, unknown>
    for (const n of names) expect(mod[n], n).toBeDefined()
  })
})
