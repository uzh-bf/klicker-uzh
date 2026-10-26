import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const prismaRoot = fileURLToPath(
  new URL('../../packages/prisma/', import.meta.url)
)
const operations = {
  bootstrap: [
    ['database-bootstrap', ['exec', 'tsx', 'scripts/northflankBootstrap.ts']],
  ],
  fixtures: [
    [
      'schema-migrations',
      ['exec', 'tsx', 'scripts/disposable-prisma.ts', 'deploy'],
    ],
    ['synthetic-fixtures', ['run', 'prisma:seed:raw']],
  ],
}

const [operation, ...extra] = process.argv.slice(2)
if (!Object.hasOwn(operations, operation) || extra.length) {
  console.error('Expected one preview operation: bootstrap or fixtures')
  process.exit(1)
}

const deadline = Date.now() + 8 * 60 * 1000
for (const [phase, args] of operations[operation]) {
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    console.error(`Preview initialization exceeded its deadline at ${phase}`)
    process.exit(1)
  }
  // Database tools inherit runtime credentials; their raw output can contain them.
  const result = spawnSync('pnpm', args, {
    cwd: prismaRoot,
    env: process.env,
    shell: false,
    encoding: 'utf8',
    timeout: remaining,
    maxBuffer: 1024 * 1024,
    stdio: 'pipe',
  })
  if (result.error || result.status !== 0) {
    console.error(`Preview initialization failed at ${phase}`)
    process.exit(1)
  }
  console.log(`Preview initialization completed: ${phase}`)
}
