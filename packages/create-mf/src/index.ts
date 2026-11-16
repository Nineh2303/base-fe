import { basename, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import * as p from '@clack/prompts'
import { generate, readFrameworkVersion, validateName, validatePort } from './generate'

const USAGE = `Usage: create-mf <name> --kind <host|remote> [--port <number>]

  npm create @nineh-fe-base/mf <name> -- --kind remote --port 5010

Options:
  --kind <host|remote>  Project kind
  --port <number>       Dev server port (default: 5000 for host, 5010 for remote)
  -h, --help            Show this help`

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      kind: { type: 'string' },
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(USAGE)
    return
  }

  let kind = values.kind as 'host' | 'remote' | undefined
  if (kind !== undefined && kind !== 'host' && kind !== 'remote') {
    fail(`Invalid --kind "${kind}": expected "host" or "remote"\n\n${USAGE}`)
  }
  let name = positionals[0]
  let port: number | undefined
  if (values.port !== undefined) {
    port = Number(values.port)
    const portError = validatePort(port)
    if (portError) fail(portError)
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  if ((!kind || !name) && !interactive) fail(`Missing arguments.\n\n${USAGE}`)

  if (interactive && (!kind || !name || port === undefined)) {
    p.intro('create-mf')
    const cancelled = () => {
      p.cancel('Cancelled')
      process.exit(1)
    }
    if (!kind) {
      const answer = await p.select({
        message: 'Project kind',
        options: [
          { value: 'host', label: 'host (shell)' },
          { value: 'remote', label: 'remote (micro-frontend service)' },
        ],
      })
      if (p.isCancel(answer)) cancelled()
      kind = answer as 'host' | 'remote'
    }
    if (!name) {
      const answer = await p.text({
        message: 'Project name',
        placeholder: kind === 'host' ? 'shell' : 'orders',
        validate: (v) => validateName(kind!, v ?? ''),
      })
      if (p.isCancel(answer)) cancelled()
      name = answer as string
    }
    if (port === undefined) {
      const fallback = kind === 'host' ? '5000' : '5010'
      const answer = await p.text({
        message: 'Dev server port',
        initialValue: fallback,
        validate: (v) => validatePort(Number(v)),
      })
      if (p.isCancel(answer)) cancelled()
      port = Number(answer)
    }
  }

  const targetDir = resolve(process.cwd(), name!)
  try {
    await generate({ kind: kind!, name: basename(name!), targetDir, port, frameworkVersion: readFrameworkVersion() })
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }

  const rel = name!
  console.log(`\nCreated ${kind} "${name}" in ${targetDir}\n\nNext steps:\n  cd ${rel}\n  npm install\n  npm run dev`)
}

main()
