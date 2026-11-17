import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, parse, resolve } from 'node:path'

const UI_PACKAGE = '@nineh2303/ui'
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
export function rewriteImports(
  source: string,
  keepRelative: ReadonlySet<string>,
  known?: ReadonlySet<string>,
  onUnknown?: (spec: string) => void,
): string {
  return source.replace(SPECIFIER, (match, lead: string, quote: string, spec: string) => {
    if (spec.startsWith('../../')) return `${lead}'${UI_PACKAGE}'`
    const sibling = spec.slice(3).split('/')[0]
    if (keepRelative.has(sibling)) return match
    // Unknown `../x` is not a ui component: leave it untouched and warn.
    if (known && !known.has(sibling)) {
      onUnknown?.(spec)
      return match
    }
    return `${lead}'${UI_PACKAGE}'`
  })
}

// Bare specifiers in `from '…'`, `import '…'` and `import('…')`.
const BARE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"./\n][^'"\n]*)\1/g

/** Package names (`pkg`, `@scope/pkg`) imported by bare specifier; `node:` builtins excluded. */
export function collectBareImports(source: string): Set<string> {
  const out = new Set<string>()
  for (const m of source.matchAll(BARE_SPECIFIER)) {
    const spec = m[2]!
    if (spec.startsWith('node:')) continue
    const parts = spec.split('/')
    out.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!)
  }
  return out
}

function readJsonIfExists(file: string): Record<string, any> | undefined {
  if (!existsSync(file)) return undefined
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Version spec to suggest for a package, taken from ui's own package.json. */
function suggestedVersion(ui: Record<string, any> | undefined, name: string): string | undefined {
  if (!ui) return undefined
  if (name === UI_PACKAGE && ui.version) return `^${ui.version}`
  return ui.dependencies?.[name] ?? ui.peerDependencies?.[name]
}

export async function ejectComponents(
  opts: EjectOptions,
): Promise<{ written: string[]; missingDependencies: string[] }> {
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
  const knownSet = new Set(available)
  const warnings = new Set<string>()
  const keepRelative = new Set(names)
  for (const n of available) if (existsSync(join(targetRoot, n, 'index.ts'))) keepRelative.add(n)

  const plan: { file: string; content: Buffer | string }[] = []
  for (const name of names) {
    for (const rel of listFiles(join(componentsDir, name))) {
      const raw = await readFile(join(componentsDir, name, rel))
      const content = /\.(ts|vue)$/.test(rel) ? rewriteImports(raw.toString('utf8'), keepRelative, knownSet, (spec) => warnings.add(`${rel}: left unknown import '${spec}' untouched`)) : raw
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
  for (const w of warnings) console.warn(`warning: ${w}`)

  // Ejected files import packages (reka-ui, lucide-vue-next, ...) that otherwise resolve only
  // through npm hoisting: compare them with the project's own package.json.
  const imported = new Set<string>()
  for (const { file, content } of plan) {
    if (typeof content === 'string' && /\.(ts|vue)$/.test(file)) {
      for (const pkg of collectBareImports(content)) imported.add(pkg)
    }
  }
  const project = readJsonIfExists(join(cwd, 'package.json'))
  const declared = { ...project?.devDependencies, ...project?.dependencies }
  const missingDependencies = [...imported].filter((p) => !(p in declared)).sort()
  if (missingDependencies.length) {
    const ui = readJsonIfExists(join(uiRoot, 'package.json'))
    const install = missingDependencies.map((p) => {
      const v = suggestedVersion(ui, p)
      return `"${v ? `${p}@${v}` : p}"`
    })
    console.warn(
      `warning: the ejected files import packages not declared in ${join(cwd, 'package.json')}: ${missingDependencies.join(', ')}\n` +
        `  They only resolve through npm hoisting today. Add them:\n  npm install ${install.join(' ')}`,
    )
  }
  if (names.includes('toast')) {
    console.warn(
      'warning: an ejected Toaster bundles its own vue-sonner store, so toast() calls made through ' +
        `${UI_PACKAGE} will not show in it. Eject Toaster only together with the code that calls toast() ` +
        '(importing toast from vue-sonner in this project), or keep using the shared Toaster.',
    )
  }
  return { written: plan.map((p) => p.file), missingDependencies }
}
