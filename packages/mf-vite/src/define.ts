import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { mergeConfig, type UserConfig, type UserConfigFnPromise } from 'vite'
import {
  buildFederationOptions,
  type FederationContext,
  type HostOptions,
  type RemoteOptions,
} from './federation'
import { CORE_PACKAGE, UI_PACKAGE } from './shared'
import { writeMetaModule } from './meta'

function readJson(file: string): Record<string, any> {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Dependencies of the consuming project, read from its package.json. */
function readVersions(pkg: Record<string, any>): Record<string, string> {
  return { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies }
}

/** Read an installed package's package.json, walking up from the project root (npm workspaces hoist). */
function readInstalledPackage(root: string, name: string): Record<string, any> {
  let dir = resolve(root)
  for (;;) {
    const file = join(dir, 'node_modules', ...name.split('/'), 'package.json')
    if (existsSync(file)) return readJson(file)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Cannot find ${name} in node_modules (searched upward from ${root})`)
}

function readCoreVersion(root: string): string {
  return readInstalledPackage(root, CORE_PACKAGE).version
}

function createContext(root: string): FederationContext {
  const pkg = readJson(join(root, 'package.json'))
  const { [UI_PACKAGE]: uiSpec, ...rest } = readVersions(pkg)
  // ui is shared only when listed in dependencies/devDependencies (a peer listing does not count)
  const usesUi = Boolean(pkg.dependencies?.[UI_PACKAGE] ?? pkg.devDependencies?.[UI_PACKAGE])
  const versions = usesUi ? { ...rest, [UI_PACKAGE]: uiSpec as string } : rest
  const ctx: FederationContext = { root, versions, coreVersion: readCoreVersion(root) }
  if (usesUi) {
    const ui = readInstalledPackage(root, UI_PACKAGE)
    ctx.ui = { version: ui.version, rekaRange: ui.dependencies?.['reka-ui'] }
  }
  return ctx
}

function baseConfig(
  kind: 'host' | 'remote',
  opts: HostOptions | RemoteOptions,
  ctx: FederationContext,
): UserConfig {
  const port = opts.port
  const config: UserConfig = {
    plugins: [
      vue(),
      ...(opts.tailwind === false ? [] : [tailwindcss()]),
      federation(buildFederationOptions(kind, opts, ctx)),
    ],
    build: { target: 'esnext' },
  }
  if (port !== undefined) {
    config.server = { port, strictPort: true, origin: `http://localhost:${port}` }
    config.preview = { port, strictPort: true }
  }
  return config
}

export function defineHost(opts: HostOptions): UserConfigFnPromise {
  return async () => {
    const ctx = createContext(process.cwd())
    return mergeConfig(baseConfig('host', opts, ctx), opts.vite ?? {})
  }
}

export function defineRemote(opts: RemoteOptions): UserConfigFnPromise {
  return async () => {
    const ctx = createContext(process.cwd())
    writeMetaModule(ctx.root, { name: opts.name, coreVersion: ctx.coreVersion })
    return mergeConfig(baseConfig('remote', opts, ctx), opts.vite ?? {})
  }
}
