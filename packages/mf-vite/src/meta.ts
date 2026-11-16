import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface RemoteMetaInput {
  name: string
  coreVersion: string
}

/** Path of the generated meta module (exposed by every remote as `./mf-meta`). */
export function metaModulePath(root: string): string {
  return join(root, 'node_modules', '.nineh-mf', 'mf-meta.js')
}

/** Write `export default {name, coreVersion}` and return the file path. */
export function writeMetaModule(root: string, meta: RemoteMetaInput): string {
  const file = metaModulePath(root)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(
    file,
    `export default ${JSON.stringify({ name: meta.name, coreVersion: meta.coreVersion })}`,
  )
  return file
}
