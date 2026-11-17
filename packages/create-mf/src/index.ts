import { basename, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import * as p from '@clack/prompts'
import { ejectComponents } from './eject'
import { generate, readFrameworkVersion, validateName, validatePort } from './generate'

const USAGE = `Usage: create-mf <name> --kind <host|remote> [--port <number>]
       create-mf ui add <component...> [--dir <path>] [--force]

  npm create @nineh-fe-base/mf <name> -- --kind remote --port 5010

Options:
  --kind <host|remote>  Project kind
  --port <number>       Dev server port (default: 5000 for host, 5010 for remote)
  --dir <path>          (ui add) Target directory (default: src/components/ui)
  --force               (ui add) Overwrite existing files
  -h, --help            Show this help

ui add copies component source from @nineh-fe-base/ui into your project.
Only "create-mf ui add ..." runs the eject command; "create-mf ui" alone
scaffolds a project named "ui".`

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
      dir: { type: 'string' },
      force: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(USAGE)
    return
  }

  if (positionals[0] === 'ui' && positionals[1] === 'add') {
    try {
      const { written } = await ejectComponents({
        names: positionals.slice(2),
        cwd: process.cwd(),
        dir: values.dir,
        force: values.force,
      })
      console.log(['Ejected ' + written.length + ' file(s):', ...written.map((f) => '  ' + relative(process.cwd(), f))].join('\n'))
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err))
    }
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
