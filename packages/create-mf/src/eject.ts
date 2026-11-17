import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, parse, resolve } from 'node:path'

const UI_PACKAGE = '@nineh-fe-base/ui'
const DEFAULT_DIR = 'src/components/ui'

export interface EjectOptions {
  names: string[]
  cwd: string
  dir?: string
  force?: boolean
  uiRoot?: string
}

/** Walk up `node_modules` from `cwd` to find the installed ui package. */
function resolveUiRoot(cwd: string): string {
  let current = resolve(cwd)
  for (;;) {
    const candidate = join(current, 'node_modules', ...UI_PACKAGE.split('/'))
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = dirname(current)
    if (parent === current || current === parse(current).root) break
    current = parent
  }
  throw new Error(`Cannot find ${UI_PACKAGE}. Install it first (npm install ${UI_PACKAGE}).`)
}

function listFiles(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(join(dir, entry)).isDirectory()) out.push(...listFiles(join(dir, entry), rel))
    else out.push(rel)
  }
  return out.sort()
}

// `from '…'`, `import '…'` and `import('…')` with single or double quotes.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.\/[^'"\n]+)\2/g

/** Rewrite relative imports that point outside the component directory. */
export function rewriteImports(source: string, keepRelative: ReadonlySet<string>): string {
  return source.replace(SPECIFIER, (match, lead: string, quote: string, spec: string) => {
    if (spec.startsWith('../../')) return `${lead}'${UI_PACKAGE}'`
    const sibling = spec.slice(3).split('/')[0]
    if (keepRelative.has(sibling)) return match
    return `${lead}'${UI_PACKAGE}'`
  })
}

export async function ejectComponents(opts: EjectOptions): Promise<{ written: string[] }> {
  const cwd = resolve(opts.cwd)
  const uiRoot = opts.uiRoot ?? resolveUiRoot(cwd)
  const componentsDir = join(uiRoot, 'src', 'components')
  const targetRoot = resolve(cwd, opts.dir ?? DEFAULT_DIR)

  const available = existsSync(componentsDir)
    ? readdirSync(componentsDir).filter((n) => statSync(join(componentsDir, n)).isDirectory()).sort()
    : []
  const list = `Available components: ${available.join(', ')}`

  if (opts.names.length === 0) throw new Error(`No component names given.\n${list}`)
  const unknown = opts.names.filter((n) => !available.includes(n))
  if (unknown.length) throw new Error(`Unknown component${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.\n${list}`)

  const names = [...new Set(opts.names)]
  const keepRelative = new Set(names)
  for (const n of available) if (existsSync(join(targetRoot, n))) keepRelative.add(n)

  const plan: { file: string; content: Buffer | string }[] = []
  for (const name of names) {
    for (const rel of listFiles(join(componentsDir, name))) {
      const raw = await readFile(join(componentsDir, name, rel))
      const content = /\.(ts|vue)$/.test(rel) ? rewriteImports(raw.toString('utf8'), keepRelative) : raw
      plan.push({ file: join(targetRoot, name, rel), content })
    }
  }

  if (!opts.force) {
    const existing = plan.filter((p) => existsSync(p.file)).map((p) => p.file)
    if (existing.length) {
      throw new Error(`Refusing to overwrite existing files (use --force):\n${existing.map((f) => `  ${f}`).join('\n')}`)
    }
  }

  for (const { file, content } of plan) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  return { written: plan.map((p) => p.file) }
}
