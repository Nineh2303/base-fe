import { describe, it, expect, afterEach } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import RemoteBoundary from '../src/remotes/RemoteBoundary.vue'
import { MF_PORTAL_KEY, useMfPortalTarget } from '../src/app/portal'

const mounted: Array<() => void> = []
afterEach(() => mounted.splice(0).forEach((u) => u()))

function mountWith(render: () => unknown) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp({ render: render as () => never })
  app.mount(el)
  mounted.push(() => {
    app.unmount()
    el.remove()
  })
  return el
}

describe('portal', () => {
  it('useMfPortalTarget returns body without a boundary', () => {
    let target!: Ref<HTMLElement | string>
    const C = defineComponent({
      setup() {
        target = useMfPortalTarget()
        return () => h('i')
      },
    })
    mountWith(() => h(C))
    expect(target.value).toBe('body')
  })

  it('useMfPortalTarget returns the boundary portal element after mount', async () => {
    let target!: Ref<HTMLElement | string>
    const C = defineComponent({
      setup() {
        target = useMfPortalTarget()
        return () => h('i')
      },
    })
    const el = mountWith(() => h(RemoteBoundary, { name: 'p' }, { default: () => h(C) }))
    await nextTick()
    await nextTick()
    const portal = el.querySelector('[data-mf-portal]')
    expect(portal).toBeTruthy()
    expect(target.value).toBe(portal)
  })

  it('MF_PORTAL_KEY is Symbol.for(nineh-fe-base/ui-portal)', () => {
    expect(MF_PORTAL_KEY).toBe(Symbol.for('nineh-fe-base/ui-portal'))
  })
})
