import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { writeMetaModule } from '../src/index'

const tmp = mkdtempSync(join(tmpdir(), 'mf-meta-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

test('writeMetaModule ghi file meta và trả path', () => {
  const p = writeMetaModule(tmp, { name: 'products', coreVersion: '1.2.3' })
  expect(p).toBe(join(tmp, 'node_modules', '.nineh-mf', 'mf-meta.js'))
  expect(readFileSync(p, 'utf8')).toBe(
    'export default {"name":"products","coreVersion":"1.2.3"}',
  )
})
