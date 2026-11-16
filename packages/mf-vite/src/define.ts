import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { mergeConfig, type UserConfig, type UserConfigFnPromise } from 'vite'
import {
  buildFederationOptions,
  type FederationContext,
  type HostOptions,
  type RemoteOptions,
} from './federation'
import { CORE_PACKAGE } from './shared'
import { writeMetaModule } from './meta'

function readJson(file: string): Record<string, any> {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** Dependencies of the consuming project, read from its package.json. */
function readVersions(root: string): Record<string, string> {
  const pkg = readJson(join(root, 'package.json'))
  return { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies }
}

/** Resolve mf-core's version from node_modules, walking up from the project root (npm workspaces hoist). */
function readCoreVersion(root: string): string {
  let dir = resolve(root)
  for (;;) {
    const file = join(dir, 'node_modules', ...CORE_PACKAGE.split('/'), 'package.json')
    if (existsSync(file)) return readJson(file).version
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Cannot find ${CORE_PACKAGE} in node_modules (searched upward from ${root})`)
}

function createContext(root: string): FederationContext {
  return { root, versions: readVersions(root), coreVersion: readCoreVersion(root) }
}

function baseConfig(
  kind: 'host' | 'remote',
  opts: HostOptions | RemoteOptions,
  ctx: FederationContext,
): UserConfig {
  const port = opts.port
  const config: UserConfig = {
    plugins: [vue(), federation(buildFederationOptions(kind, opts, ctx))],
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
