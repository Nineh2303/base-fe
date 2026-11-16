import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VERSIONS } from './versions'

export interface GenerateOptions {
  kind: 'host' | 'remote'
  name: string
  targetDir: string
  port?: number
  /** Version of the framework packages (create-mf's own package.json version). */
  frameworkVersion: string
}

/** Same rule as mf-vite: the name is a JS identifier (it becomes the federation container name). */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
/** Valid unscoped npm package name (lowercase). */
const NPM_NAME = /^[a-z0-9-~][a-z0-9-._~]*$/

const DEFAULT_PORT = { host: 5000, remote: 5010 } as const

/** Files renamed on generation (npm strips real dotfiles like .gitignore when publishing). */
const RENAMES: Record<string, string> = { _gitignore: '.gitignore', _npmrc: '.npmrc' }

const here = dirname(fileURLToPath(import.meta.url))
/** `src/` and `dist/` are both one level below the package root. */
const PACKAGE_ROOT = join(here, '..')

/** create-mf's own version, shared by the framework packages. */
export function readFrameworkVersion(): string {
  return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version
}

export function validateName(kind: 'host' | 'remote', name: string): string | undefined {
  // defineHost/defineRemote both use the name as the federation container name, so both must be identifiers.
  if (!IDENTIFIER.test(name)) {
    return `Invalid ${kind} name "${name}": must be a valid JavaScript identifier (letters, digits, "_" or "$", not starting with a digit; no hyphens)`
  }
  if (kind === 'host' && !NPM_NAME.test(name)) {
    return `Invalid host name "${name}": must also be a valid npm package name (lowercase)`
  }
  return undefined
}

export function validatePort(port: number): string | undefined {
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? undefined : `Invalid port "${port}": must be 1-65535`
}

function render(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match)
}

function copyDir(src: string, dest: string, values: Record<string, string>): void {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    const from = join(src, entry)
    const to = join(dest, RENAMES[entry] ?? entry)
    if (statSync(from).isDirectory()) copyDir(from, to, values)
    else writeFileSync(to, render(readFileSync(from, 'utf8'), values))
  }
}

export async function generate(opts: GenerateOptions): Promise<void> {
  const { kind, name, targetDir, frameworkVersion } = opts
  const nameError = validateName(kind, name)
  if (nameError) throw new Error(nameError)
  const port = opts.port ?? DEFAULT_PORT[kind]
  const portError = validatePort(port)
  if (portError) throw new Error(portError)

  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory "${targetDir}" is not empty`)
  }

  copyDir(join(PACKAGE_ROOT, 'templates', kind), targetDir, {
    ...VERSIONS,
    name,
    port: String(port),
    frameworkVersion,
  })
}
