import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const prismaRoot = fileURLToPath(
  new URL('../../packages/prisma/', import.meta.url)
)
const operations = {
  bootstrap: [['database-bootstrap', ['scripts/previewBootstrap.js']]],
  fixtures: [
    ['schema-migrations', ['scripts/disposable-prisma.js', 'deploy']],
    ['synthetic-fixtures', ['../prisma-data/src/data/seedTEST.js']],
    [
      'synthetic-assessment-fixtures',
      ['../prisma-data/src/data/seedAssessmentCourse.js'],
    ],
    ['fixture-bindings', ['../../deploy/preview/configure-fixtures.mjs']],
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
  const result = spawnSync(process.execPath, args, {
    cwd: prismaRoot,
    env: { ...process.env, ENV: 'development' },
    timeout: remaining,
    stdio: 'ignore',
  })
  if (result.error || result.status !== 0) {
    if (
      phase === 'database-bootstrap' &&
      [2, 3, 4, 5].includes(result.status)
    ) {
      console.error(`KLICKER_BOOTSTRAP_FAILURE_${result.status}`)
    }
    console.error(`Preview initialization failed at ${phase}`)
    process.exit(1)
  }
  if (operation === 'bootstrap' && process.env.DRY_RUN !== 'false') {
    console.log('Preview database bootstrap validated (dry run, no writes)')
  } else {
    console.log(`Preview initialization completed: ${phase}`)
  }
}
