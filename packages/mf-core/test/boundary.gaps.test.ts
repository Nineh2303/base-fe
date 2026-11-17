import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { Component } from 'vue'
import RemoteBoundary from '../src/remotes/RemoteBoundary.vue'

const mounted: Array<() => void> = []
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  mounted.splice(0).forEach((u) => u())
})
async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
function mountComp(comp: Component, props: Record<string, unknown>, slot: () => unknown) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render: () => h(comp, props, { default: slot }) })
  app.mount(el)
  mounted.push(() => {
    app.unmount()
    el.remove()
  })
  return { el, app }
}
const never = defineComponent({
  async setup() {
    await new Promise(() => {})
    return () => h('p')
  },
})
/** Resolves on demand. */
function deferred() {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const comp = defineComponent({
    async setup() {
      await gate
      return () => h('p', { class: 'ok' }, 'content')
    },
  })
  return { comp, release }
}

describe('RemoteBoundary timeout gaps', () => {
  it('timeout 0 disables the timer: a slow slot stays in loading state forever', async () => {
    vi.useFakeTimers()
    const { el } = mountComp(RemoteBoundary, { name: 's', timeout: 0 }, () => h(never))
    await flush()
    vi.advanceTimersByTime(10 * 60_000)
    await flush()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
    expect(el.querySelector('.mf-remote-loading')).not.toBeNull()
  })

  it('unmounting while pending clears the timer (no late state change / error)', async () => {
    vi.useFakeTimers()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { app } = mountComp(RemoteBoundary, { name: 's', timeout: 100 }, () => h(never))
    await flush()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    app.unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('retry after a timeout restarts the timeout window and can succeed', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deferred()
    let useSlow = true
    const { el } = mountComp(RemoteBoundary, { name: 'r', timeout: 100 }, () => h(useSlow ? never : d.comp))
    await flush()
    vi.advanceTimersByTime(150)
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toMatch(/Timeout/i)
    useSlow = false
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    await flush()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
    vi.advanceTimersByTime(50)
    d.release()
    await flush()
    vi.advanceTimersByTime(500)
    await flush()
    expect(el.querySelector('.ok')?.textContent).toBe('content')
    expect(el.querySelector('.mf-remote-error')).toBeNull()
  })

  it('retry that times out again shows the timeout error a second time', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { el } = mountComp(RemoteBoundary, { name: 'r', timeout: 100 }, () => h(never))
    await flush()
    vi.advanceTimersByTime(150)
    await flush()
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    await flush()
    expect(el.querySelector('.mf-remote-error')).toBeNull()
    vi.advanceTimersByTime(150)
    await flush()
    expect(el.querySelector('.mf-remote-error')).not.toBeNull()
  })

  it('a non-Error throw is wrapped so the frame still shows a message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = defineComponent({
      setup() {
        throw 'plain string failure'
      },
    })
    const { el } = mountComp(RemoteBoundary, { name: 'x' }, () => h(bad))
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toContain('plain string failure')
  })

  it('error prop wins over a captured runtime error and retry only emits (parent decides)', async () => {
    const onRetry = vi.fn()
    const { el } = mountComp(RemoteBoundary, { name: 'p', error: new Error('load failed'), onRetry }, () => h('i'))
    await flush()
    expect(el.querySelector('.mf-remote-error')?.textContent).toContain('load failed')
    ;(el.querySelector('[data-test="mf-retry"]') as HTMLElement).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
