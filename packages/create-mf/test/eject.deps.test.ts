import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectBareImports, ejectComponents } from '../src/eject'

let base: string
let uiRoot: string
let cwd: string

function put(root: string, file: string, content: string) {
  const full = join(root, file)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'create-mf-eject-deps-'))
  uiRoot = join(base, 'ui')
  cwd = join(base, 'app')
  mkdirSync(cwd)
  put(
    uiRoot,
    'package.json',
    JSON.stringify({
      name: '@nineh-fe-base/ui',
      version: '0.1.0',
      dependencies: { 'reka-ui': '^2.11.0', 'lucide-vue-next': '^1.0.0', 'vue-sonner': '^2.0.9' },
      peerDependencies: { vue: '^3.5.0' },
    }),
  )
  put(
    uiRoot,
    'src/components/select/Select.vue',
    [
      '<script setup lang="ts">',
      "import { computed } from 'vue'",
      "import type { SelectRootProps } from 'reka-ui'",
      "import { ChevronDown } from 'lucide-vue-next'",
      "import { cn } from '../../lib/utils'",
      "import Item from './Item.vue'",
      '</script>',
    ].join('\n'),
  )
  put(uiRoot, 'src/components/select/index.ts', "export { default as Select } from './Select.vue'\n")
  put(uiRoot, 'src/components/toast/Toaster.vue', "<script setup lang=\"ts\">\nimport { Toaster } from 'vue-sonner'\n</script>\n")
})
afterEach(() => {
  rmSync(base, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('collectBareImports', () => {
  it('returns package names of bare imports, ignoring relative, absolute and node: specifiers', () => {
    const src = [
      "import { a } from 'reka-ui'",
      "import type { B } from '@scope/pkg/sub/path'",
      "import 'side-effect/style.css'",
      "const x = () => import('lazy-pkg')",
      "export * from 'reexported'",
      "import y from './local'",
      "import z from '../sibling'",
      "import fs from 'node:fs'",
      "import abs from '/abs/path'",
    ].join('\n')
    expect([...collectBareImports(src)].sort()).toEqual(
      ['@scope/pkg', 'lazy-pkg', 'reexported', 'reka-ui', 'side-effect'].sort(),
    )
  })
})

describe('ejectComponents: missing dependency warning', () => {
  it('reports bare imports not in package.json, with an npm install line using ui versions', async () => {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.5.0' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { missingDependencies } = await ejectComponents({ names: ['select'], cwd, uiRoot })
    // the rewritten '../../lib/utils' import becomes '@nineh-fe-base/ui', also undeclared here
    expect(missingDependencies).toEqual(['@nineh-fe-base/ui', 'lucide-vue-next', 'reka-ui'])
    const out = warn.mock.calls.map((c) => String(c[0])).join('\n')
    expect(out).toContain('@nineh-fe-base/ui, lucide-vue-next, reka-ui')
    expect(out).toContain('npm install "@nineh-fe-base/ui@^0.1.0" "lucide-vue-next@^1.0.0" "reka-ui@^2.11.0"')
  })

  it('counts devDependencies as declared and warns about nothing when all are present', async () => {
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.5.0', '@nineh-fe-base/ui': '^0.1.0' },
        devDependencies: { 'reka-ui': '^2.11.0', 'lucide-vue-next': '^1.0.0' },
      }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { missingDependencies } = await ejectComponents({ names: ['select'], cwd, uiRoot })
    expect(missingDependencies).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it('a dependency missing from ui package.json is listed without a version', async () => {
    put(uiRoot, 'src/components/select/Extra.ts', "import { x } from 'unlisted-pkg'\n")
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.5.0', '@nineh-fe-base/ui': '^0.1.0', 'reka-ui': '^2', 'lucide-vue-next': '^1' },
      }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { missingDependencies } = await ejectComponents({ names: ['select'], cwd, uiRoot })
    expect(missingDependencies).toEqual(['unlisted-pkg'])
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('npm install "unlisted-pkg"')
  })

  it('warns about the Toaster caveat when toast is ejected', async () => {
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ dependencies: { 'vue-sonner': '^2.0.9' } }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await ejectComponents({ names: ['toast'], cwd, uiRoot })
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/Toaster.*own vue-sonner/s)
  })

  it('no package.json in cwd: every bare import is reported', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { missingDependencies } = await ejectComponents({ names: ['toast'], cwd, uiRoot })
    expect(missingDependencies).toEqual(['vue-sonner'])
  })
})
