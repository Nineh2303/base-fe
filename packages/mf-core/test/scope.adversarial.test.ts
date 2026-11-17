import { describe, it, expect, vi, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import RemoteBoundary from '../src/remotes/RemoteBoundary.vue'
import { useMfPortalTarget } from '../src/app/portal'
import { defineRemoteComponent } from '../src/remotes/loader'
import { createStandaloneRemote, createTheme, DEFAULT_TOKENS } from '../src/index'

const mounted: Array<() => void> = []
afterEach(() => {
  vi.restoreAllMocks()
  mounted.splice(0).forEach((u) => u())
})
async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
function mountWith(render: () => unknown, router?: ReturnType<typeof createRouter>) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render: render as () => never })
  if (router) app.use(router)
  app.config.warnHandler = () => {}
  app.mount(el)
  mounted.push(() => {
    app.unmount()
    el.remove()
  })
  return el
}
function probe(out: { t?: Ref<HTMLElement | string> }) {
  return defineComponent({
    setup() {
      out.t = useMfPortalTarget()
      return () => h('i')
    },
  })
}

describe('portal target reactivity', () => {
  it('nested boundaries: innermost portal wins', async () => {
    const out: { t?: Ref<HTMLElement | string> } = {}
    const P = probe(out)
    const el = mountWith(() =>
      h(RemoteBoundary, { name: 'outer' }, { default: () => h(RemoteBoundary, { name: 'inner' }, { default: () => h(P) }) }),
    )
    await flush()
    const inner = el.querySelector('[data-mf-remote="inner"] > [data-mf-portal]')
    expect(inner).toBeTruthy()
    expect(out.t!.value).toBe(inner)
    expect(out.t!.value).not.toBe(el.querySelector('[data-mf-remote="outer"] > [data-mf-portal]'))
  })
})

describe('scope survives error -> retry', () => {
  it('keeps one wrapper and portal as last child after retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    const C = defineComponent({
      setup() {
        if (fail) throw new Error('boom')
        return () => h('p', { class: 'ok' }, 'ok')
      },
    })
    const el = mountWith(() => h(RemoteBoundary, { name: 'orders' }, { default: () => h(C) }))
    await flush()
    const root = el.firstElementChild as HTMLElement
    const portal = root.querySelector('[data-mf-portal]')
    expect(root.querySelector('.mf-remote-error')).toBeTruthy()
    expect(root.lastElementChild).toBe(portal)
    fail = false
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    await flush()
    expect(el.querySelectorAll('[data-mf-remote]').length).toBe(1)
    expect(el.firstElementChild).toBe(root)
    expect(root.querySelector('.ok')).toBeTruthy()
    expect(root.lastElementChild).toBe(portal)
    expect(root.querySelectorAll('[data-mf-portal]').length).toBe(1)
  })

  it('route-change reset keeps wrapper and portal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Bad = defineComponent({ setup() { throw new Error('bad') } })
    const Good = defineComponent({ render: () => h('p', { class: 'good' }, 'g') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/bad', component: Bad },
        { path: '/good', component: Good },
      ],
    })
    await router.push('/bad')
    const el = mountWith(() => h(RemoteBoundary, { name: 'r' }, { default: () => h(RouterView) }), router)
    await flush()
    const root = el.firstElementChild as HTMLElement
    const portal = root.querySelector('[data-mf-portal]')
    expect(root.querySelector('.mf-remote-error')).toBeTruthy()
    await router.push('/good')
    await flush()
    expect(root.querySelector('.good')).toBeTruthy()
    expect(root.querySelector('.mf-remote-error')).toBeNull()
    expect(el.firstElementChild).toBe(root)
    expect(root.lastElementChild).toBe(portal)
  })
})

describe('scope naming', () => {
  it('defineRemoteComponent("products/Widget") scopes to products (success and error)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const W = defineComponent({ render: () => h('span', 'w') })
    const ok = defineRemoteComponent('products/Widget', {
      runtime: { registerRemotes() {}, loadRemote: async () => ({ default: W }) } as never,
    })
    const bad = defineRemoteComponent('products/Widget', {
      runtime: { registerRemotes() {}, loadRemote: async () => { throw new Error('x') } } as never,
    })
    const el = mountWith(() => [h(ok), h(bad)])
    await flush()
    const scopes = [...el.querySelectorAll('[data-mf-remote]')].map((n) => n.getAttribute('data-mf-remote'))
    expect(scopes).toEqual(['products', 'products'])
  })

  it('standalone remote renders data-mf-remote=<name>', async () => {
    const history = createMemoryHistory()
    history.replace('/products')
    const handle = await createStandaloneRemote({
      name: 'products',
      routes: [{ path: '', component: defineComponent({ render: () => h('div', { class: 'pg' }, 'p') }) }],
      routePrefix: '/products',
      api: { baseURL: 'http://api' },
      history,
    })
    const target = document.createElement('div')
    document.body.appendChild(target)
    await handle.mount(target)
    mounted.push(() => { handle.app.unmount(); target.remove() })
    const scope = target.querySelector('[data-mf-remote="products"]')
    expect(scope).toBeTruthy()
    expect(scope!.querySelector('.pg')).toBeTruthy()
    expect(scope!.lastElementChild!.matches('[data-mf-portal]')).toBe(true)
  })
})

describe('tokens', () => {
  it('alias pairs equal in both modes and createTheme applies shadcn vars on <html>', () => {
    const pairs: Array<[string, string]> = [
      ['color-bg', 'color-background'],
      ['color-text', 'color-foreground'],
      ['color-on-primary', 'color-primary-foreground'],
      ['color-danger', 'color-destructive'],
      ['color-border', 'color-input'],
      ['color-primary', 'color-ring'],
    ]
    for (const mode of ['light', 'dark'] as const) {
      const t = DEFAULT_TOKENS[mode]
      for (const [a, b] of pairs) expect(t[b], `${mode} ${b} vs ${a}`).toBe(t[a])
    }
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    createTheme({ tokens: DEFAULT_TOKENS })
    const st = document.documentElement.style
    expect(st.getPropertyValue('--mf-color-ring')).toBe(DEFAULT_TOKENS.light['color-ring'])
    expect(st.getPropertyValue('--mf-color-card')).toBe(DEFAULT_TOKENS.light['color-card'])
  })
})

const distEntry = resolve(__dirname, '../dist/index.js')

describe('built dist exports', () => {
  it.skipIf(!existsSync(distEntry))('exports MF_PORTAL_KEY and useMfPortalTarget (skipped without dist)', async () => {
    const url = pathToFileURL(distEntry)
    const dist = await import(/* @vite-ignore */ url.href)
    expect(dist.MF_PORTAL_KEY).toBe(Symbol.for('nineh-fe-base/ui-portal'))
    expect(typeof dist.useMfPortalTarget).toBe('function')
  })
})
