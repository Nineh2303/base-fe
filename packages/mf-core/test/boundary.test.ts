import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { Component } from 'vue'
import RemoteBoundary from '../src/remotes/RemoteBoundary.vue'
import RemoteErrorPage from '../src/remotes/RemoteErrorPage.vue'
import { useMfContext } from '../src/app/context'

const mounted: Array<() => void> = []
afterEach(() => {
  vi.useRealTimers()
  mounted.splice(0).forEach((u) => u())
})

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

function mountComp(comp: Component, props: Record<string, unknown>, slot?: () => unknown, onErr?: (e: unknown) => void) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render: () => h(comp, props, slot ? { default: slot } : undefined) })
  if (onErr) app.config.errorHandler = onErr
  app.mount(el)
  mounted.push(() => {
    app.unmount()
    el.remove()
  })
  return el
}

function flaky() {
  let fail = true
  return {
    heal: () => {
      fail = false
    },
    comp: defineComponent({
      setup() {
        if (fail) throw new Error('boom')
        return () => h('p', { class: 'ok' }, 'content')
      },
    }),
  }
}

describe('RemoteBoundary', () => {
  it('catches child error, shows name, does not propagate; retry remounts', async () => {
    const f = flaky()
    const parentErr = vi.fn()
    const el = mountComp(RemoteBoundary, { name: 'orders' }, () => h(f.comp), parentErr)
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toContain('orders')
    expect(parentErr).not.toHaveBeenCalled()
    f.heal()
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    await flush()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
    expect(el.querySelector('.ok')?.textContent).toBe('content')
  })

  it('emits retry', async () => {
    const f = flaky()
    const onRetry = vi.fn()
    const el = mountComp(RemoteBoundary, { name: 'o', onRetry }, () => h(f.comp))
    await flush()
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows frame for error prop', () => {
    const el = mountComp(RemoteBoundary, { name: 'x', error: new Error('load fail') })
    expect(el.querySelector('.mf-remote-error')?.textContent).toContain('load fail')
  })

  it('shows timeout error when async slot does not resolve', async () => {
    vi.useFakeTimers()
    const never = defineComponent({
      async setup() {
        await new Promise(() => {})
        return () => h('i')
      },
    })
    const el = mountComp(RemoteBoundary, { name: 'slow', timeout: 500 }, () => h(never))
    await flush()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
    vi.advanceTimersByTime(600)
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toMatch(/slow[\s\S]*timeout|timeout[\s\S]*slow/i)
  })

  it('no timeout when async slot resolves in time', async () => {
    vi.useFakeTimers()
    const fast = defineComponent({
      async setup() {
        return () => h('b', { class: 'fast' }, 'hi')
      },
    })
    const el = mountComp(RemoteBoundary, { name: 'fast', timeout: 500 }, () => h(fast))
    await flush()
    vi.advanceTimersByTime(1000)
    await flush()
    expect(el.querySelector('.fast')).not.toBeNull()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
  })
})

describe('RemoteErrorPage', () => {
  it('renders critical page and emits retry', () => {
    const onRetry = vi.fn()
    const el = mountComp(RemoteErrorPage, { name: 'auth-ui', error: new Error('bad'), onRetry })
    expect(el.querySelector('[data-test="mf-critical-error"]')?.textContent).toContain('auth-ui')
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('useMfContext', () => {
  it('throws outside provider', () => {
    const C = defineComponent({
      setup() {
        useMfContext()
        return () => null
      },
    })
    const err = vi.fn()
    mountComp(C, {}, undefined, err)
    expect(String(err.mock.calls[0]?.[0])).toMatch(/MfContext/)
  })
})

describe('RemoteBoundary edge cases', () => {
  it('captures async onMounted rejection and event handler errors without reaching app handler', async () => {
    const parentErr = vi.fn()
    const C = defineComponent({
      async setup() {
        return () => h('p')
      },
      mounted() {
        return Promise.reject(new Error('async-mounted'))
      },
    })
    const el = mountComp(RemoteBoundary, { name: 'a' }, () => h(C), parentErr)
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toContain('async-mounted')
    expect(parentErr).not.toHaveBeenCalled()

    const H = defineComponent({
      setup: () => () =>
        h('button', {
          class: 'b',
          onClick: () => {
            throw new Error('handler')
          },
        }),
    })
    const parentErr2 = vi.fn()
    const el2 = mountComp(RemoteBoundary, { name: 'h' }, () => h(H), parentErr2)
    await flush()
    ;(el2.querySelector('.b') as HTMLElement).click()
    await flush()
    expect(el2.querySelector('.mf-remote-error')?.textContent).toContain('handler')
    expect(parentErr2).not.toHaveBeenCalled()
  })

  it('shows error frame again when retry fails again, without leaking timers', async () => {
    vi.useFakeTimers()
    const f = flaky()
    const el = mountComp(RemoteBoundary, { name: 'r', timeout: 500 }, () => h(f.comp))
    await flush()
    for (let i = 0; i < 3; i++) {
      expect(el.querySelectorAll('.mf-remote-error').length).toBe(1)
      ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
      await flush()
    }
    expect(el.querySelectorAll('.mf-remote-error').length).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('late resolve after timeout does not flash content; sync slot never times out', async () => {
    vi.useFakeTimers()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const late = defineComponent({
      async setup() {
        await gate
        return () => h('i', { class: 'late' })
      },
    })
    const el = mountComp(RemoteBoundary, { name: 'late', timeout: 100 }, () => h(late))
    await flush()
    vi.advanceTimersByTime(200)
    await flush()
    release()
    await flush()
    expect(el.querySelector('.mf-remote-error')).not.toBeNull()
    expect(el.querySelector('.late')).toBeNull()

    const sync = defineComponent({ setup: () => () => h('u', { class: 'sync' }) })
    const el2 = mountComp(RemoteBoundary, { name: 's', timeout: 100 }, () => h(sync))
    await flush()
    vi.advanceTimersByTime(1000)
    await flush()
    expect(el2.querySelector('.sync')).not.toBeNull()
    expect(el2.querySelector('.mf-remote-error')).toBeNull()
  })

  it('wrapping RouterView: navigating from failed route to healthy route clears the error', async () => {
    const { createRouter, createMemoryHistory, RouterView } = await import('vue-router')
    const Bad = defineComponent({
      setup() {
        throw new Error('bad-route')
      },
    })
    const Good = defineComponent({ setup: () => () => h('p', { class: 'good' }, 'good') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/bad', component: Bad },
        { path: '/good', component: Good },
      ],
    })
    await router.push('/bad')
    const el = document.createElement('div')
    document.body.appendChild(el)
    const app = createApp({ render: () => h(RemoteBoundary, { name: 'rt' }, { default: () => h(RouterView) }) })
    app.use(router)
    app.mount(el)
    mounted.push(() => {
      app.unmount()
      el.remove()
    })
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toContain('bad-route')
    await router.push('/good')
    await flush()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
    expect(el.querySelector('.good')).not.toBeNull()
  })
})
