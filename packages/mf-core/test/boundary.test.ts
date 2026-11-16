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
