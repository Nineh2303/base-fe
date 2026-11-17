import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'

// Smoke test of the BUILT bundle (run `npm run build -w @nineh2303/mf-core` first). Skipped when dist is absent.
const distPath = pathToFileURL(resolve(__dirname, '../dist/index.js'))
const built = existsSync(distPath)

describe.skipIf(!built)('built dist/index.js', () => {
  it('createMfApp from the bundle mounts and renders a route', async () => {
    const dist = await import(/* @vite-ignore */ distPath.href)
    const Root = defineComponent({ setup: () => () => h('div', { class: 'root' }, [h(RouterView)]) })
    const history = createMemoryHistory()
    history.replace('/')
    const handle = await dist.createMfApp({
      root: Root,
      routes: [{ path: '/', component: defineComponent({ render: () => h('p', 'dist-home') }) }],
      auth: dist.createMockAuthAdapter(),
      api: { baseURL: 'http://api' },
      history,
    })
    const target = document.createElement('div')
    document.body.appendChild(target)
    await handle.mount(target)
    expect(target.textContent).toContain('dist-home')
    expect(typeof dist.useMfLayout).toBe('function')
    handle.app.unmount()
  })
})
