import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import type { Component } from 'vue'
import { RemoteBoundary } from '@nineh-fe-base/mf-core'
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  Toaster, toast,
} from '../src'

// jsdom lacks ResizeObserver (used by reka's popper/size helpers).
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

async function mountApp(render: () => unknown) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render: render as () => never })
  app.mount(el)
  cleanups.push(() => app.unmount())
  for (let i = 0; i < 5; i++) await nextTick()
  return el
}
const boundary = (child: () => unknown) => () => h(RemoteBoundary as Component, { name: 'orders' }, { default: child })
const flush = async () => {
  for (let i = 0; i < 5; i++) await nextTick()
}

const dialog = (props: Record<string, unknown>) => () =>
  h(Dialog, props, { default: () => h(DialogContent, { 'data-t': 'c' }, { default: () => [h(DialogTitle, null, { default: () => 'T' }), h(DialogDescription, null, { default: () => 'D' })] }) })
const dropdown = () =>
  h(DropdownMenu, { open: true, modal: false }, { default: () => [h(DropdownMenuTrigger, null, { default: () => 'x' }), h(DropdownMenuContent, { 'data-t': 'c' }, { default: () => h(DropdownMenuItem, null, { default: () => 'i' }) })] })
const select = () =>
  h(Select, { open: true, defaultValue: 'a' }, { default: () => [h(SelectTrigger, null, { default: () => h(SelectValue) }), h(SelectContent, { 'data-t': 'c' }, { default: () => h(SelectItem, { value: 'a' }, { default: () => 'A' }) })] })
const tooltip = () =>
  h(TooltipProvider, null, { default: () => h(Tooltip, { open: true }, { default: () => [h(TooltipTrigger, null, { default: () => 't' }), h(TooltipContent, { 'data-t': 'c' }, { default: () => 'tip' })] }) })

const cases: Array<[string, () => unknown, string]> = [
  ['DialogContent', dialog({ open: true }), '[data-slot=dialog-content]'],
  ['DropdownMenuContent', dropdown, '[data-slot=dropdown-menu-content]'],
  ['SelectContent', select, '[data-slot=select-content]'],
  ['TooltipContent', tooltip, '[data-slot=tooltip-content]'],
]

describe('scoped portals', () => {
  for (const [name, view, sel] of cases) {
    it(`${name} teleports into the enclosing data-mf-portal`, async () => {
      const el = await mountApp(boundary(view))
      const portal = el.querySelector('[data-mf-remote] [data-mf-portal]')!
      expect(portal).toBeTruthy()
      const content = document.body.querySelector(sel)
      expect(content).toBeTruthy()
      expect(portal.contains(content)).toBe(true)
    })
    it(`${name} falls back to body without a boundary`, async () => {
      await mountApp(view)
      const content = document.body.querySelector(sel)
      expect(content).toBeTruthy()
      expect(document.body.querySelector('[data-mf-portal]')).toBeNull()
      expect(content!.closest('[data-mf-remote]')).toBeNull()
    })
  }

  it('Dialog open at first render (open / default-open) still ends up inside the scope', async () => {
    for (const props of [{ open: true }, { defaultOpen: true }]) {
      document.body.innerHTML = ''
      const el = await mountApp(boundary(dialog(props)))
      const portal = el.querySelector('[data-mf-portal]')!
      const content = document.body.querySelector('[data-slot=dialog-content]')
      expect(content).toBeTruthy()
      expect(portal.contains(content)).toBe(true)
      expect(document.body.querySelector('[data-slot=dialog-overlay]')!.closest('[data-mf-portal]')).toBe(portal)
      cleanups.splice(0).forEach((c) => c())
    }
  })

  it('Toaster mounts into the portal target', async () => {
    const el = await mountApp(boundary(() => h(Toaster)))
    toast('hello')
    await flush()
    const portal = el.querySelector('[data-mf-portal]')!
    expect(portal.querySelector('[data-sonner-toaster]')).toBeTruthy()
  })
})
