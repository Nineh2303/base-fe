import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ejectComponents } from '../src/eject'

let base: string
let uiRoot: string
let cwd: string

function put(root: string, file: string, content: string) {
  const full = join(root, file)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'create-mf-eject-'))
  uiRoot = join(base, 'ui')
  cwd = join(base, 'app')
  mkdirSync(cwd)
  put(uiRoot, 'src/lib/utils.ts', 'export const cn = () => ""')
  put(uiRoot, 'src/components/button/index.ts', "export { default as Button } from './Button.vue'\n")
  put(
    uiRoot,
    'src/components/button/Button.vue',
    `<script setup lang="ts">\nimport { cn } from '../../lib/utils'\nimport { buttonVariants } from "./buttonVariants"\n</script>\n`,
  )
  put(uiRoot, 'src/components/button/buttonVariants.ts', "import { cva } from 'cva'\nexport const buttonVariants = cva('')\n")
  put(
    uiRoot,
    'src/components/dialog/Dialog.vue',
    `<script setup lang="ts">\nimport { cn } from "../../lib/utils"\nimport { usePortalTo } from '../../lib/portal'\nimport { Button } from '../button'\nimport { buttonVariants } from '../button/buttonVariants'\nimport Content from './Content.vue'\nconst lazy = () => import('../button')\n</script>\n`,
  )
  put(uiRoot, 'src/components/dialog/Content.vue', '<template><div /></template>\n')
  put(uiRoot, 'src/components/dialog/index.ts', "export * from '../button'\nexport { default as Dialog } from './Dialog.vue'\n")
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

const read = (file: string) => readFileSync(join(cwd, file), 'utf8')

describe('ejectComponents', () => {
  it('copies a component and rewrites lib imports', async () => {
    const { written } = await ejectComponents({ names: ['button'], cwd, uiRoot })
    expect(written.length).toBe(3)
    const vue = read('src/components/ui/button/Button.vue')
    expect(vue).toContain("import { cn } from '@nineh-fe-base/ui'")
    expect(vue).toContain('from "./buttonVariants"')
    expect(read('src/components/ui/button/index.ts')).toContain("'./Button.vue'")
  })

  it('rewrites lib imports with double quotes and keeps same-dir imports', async () => {
    await ejectComponents({ names: ['dialog'], cwd, uiRoot })
    const vue = read('src/components/ui/dialog/Dialog.vue')
    expect(vue).toContain('import { cn } from \'@nineh-fe-base/ui\'')
    expect(vue).toContain("import { usePortalTo } from '@nineh-fe-base/ui'")
    expect(vue).toContain("from './Content.vue'")
  })

  it('rewrites sibling imports when the sibling is not ejected', async () => {
    await ejectComponents({ names: ['dialog'], cwd, uiRoot })
    const vue = read('src/components/ui/dialog/Dialog.vue')
    expect(vue).toContain("import { Button } from '@nineh-fe-base/ui'")
    expect(vue).toContain("import { buttonVariants } from '@nineh-fe-base/ui'")
    expect(vue).toContain("import('@nineh-fe-base/ui')")
    expect(read('src/components/ui/dialog/index.ts')).toContain("export * from '@nineh-fe-base/ui'")
  })

  it('keeps sibling imports relative when ejected in the same command', async () => {
    await ejectComponents({ names: ['dialog', 'button'], cwd, uiRoot })
    const vue = read('src/components/ui/dialog/Dialog.vue')
    expect(vue).toContain("import { Button } from '../button'")
    expect(vue).toContain("from '../button/buttonVariants'")
    expect(vue).toContain("import('../button')")
    expect(vue).toContain("from '@nineh-fe-base/ui'")
  })

  it('keeps sibling imports relative when the sibling already exists in the target', async () => {
    await ejectComponents({ names: ['button'], cwd, uiRoot })
    await ejectComponents({ names: ['dialog'], cwd, uiRoot })
    expect(read('src/components/ui/dialog/Dialog.vue')).toContain("import { Button } from '../button'")
  })

  it('refuses to overwrite without force and writes nothing', async () => {
    put(cwd, 'src/components/ui/button/Button.vue', 'mine')
    await expect(ejectComponents({ names: ['dialog', 'button'], cwd, uiRoot })).rejects.toThrow(/Button\.vue/)
    expect(existsSync(join(cwd, 'src/components/ui/dialog'))).toBe(false)
    expect(read('src/components/ui/button/Button.vue')).toBe('mine')
  })

  it('overwrites with force', async () => {
    put(cwd, 'src/components/ui/button/Button.vue', 'mine')
    await ejectComponents({ names: ['button'], cwd, uiRoot, force: true })
    expect(read('src/components/ui/button/Button.vue')).toContain('@nineh-fe-base/ui')
  })

  it('rejects unknown names listing available components, writing nothing', async () => {
    await expect(ejectComponents({ names: ['button', 'nope'], cwd, uiRoot })).rejects.toThrow(
      /nope[\s\S]*button, dialog/,
    )
    expect(existsSync(join(cwd, 'src'))).toBe(false)
  })

  it('rejects an empty name list listing available components', async () => {
    await expect(ejectComponents({ names: [], cwd, uiRoot })).rejects.toThrow(/button, dialog/)
  })

  it('honours a custom dir', async () => {
    await ejectComponents({ names: ['button'], cwd, uiRoot, dir: 'lib/ui' })
    expect(existsSync(join(cwd, 'lib/ui/button/Button.vue'))).toBe(true)
  })

  it('resolves uiRoot from node_modules walking up from cwd', async () => {
    put(base, 'node_modules/@nineh-fe-base/ui/package.json', '{}')
    put(base, 'node_modules/@nineh-fe-base/ui/src/components/button/Button.vue', 'x')
    await ejectComponents({ names: ['button'], cwd })
    expect(read('src/components/ui/button/Button.vue')).toBe('x')
  })
})
