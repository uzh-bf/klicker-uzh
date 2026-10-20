import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {
  assertDisposableDatabaseIdentity,
  assertNoPostgresEnvironmentOverrides,
  type DisposableDatabase,
  disposableDatabaseIdentityQuery,
  validateDisposableDatabaseUrl,
} from '../src/disposableDatabase.js'

export function guardedPrismaCommand(operation: string, args: string[]) {
  const commands: Record<string, string[]> = {
    reset: ['migrate', 'reset'],
    push: ['db', 'push'],
    migrate: ['migrate', 'dev'],
    seed: ['db', 'seed'],
    diff: [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-migrations',
      'src/prisma/schema/migrations',
    ],
  }
  const command = commands[operation]
  if (!command) throw new Error('Unsupported guarded Prisma operation')
  const flags: Record<string, string[]> = {
    reset: ['--force', '-f'],
    push: ['--accept-data-loss', '--force-reset'],
    migrate: ['--create-only'],
    seed: [],
    diff: ['--script', '--exit-code'],
  }
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!
    if (flags[operation]!.includes(argument)) continue
    if (operation === 'migrate' && ['--name', '-n'].includes(argument)) {
      const name = args[++index]
      if (name && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) continue
    }
    throw new Error(
      'Unsupported Prisma argument; destination overrides are forbidden'
    )
  }
  return [...command, ...args]
}

async function verify(
  connectionString: string | undefined,
  database: DisposableDatabase
) {
  const client = new pg.Client({
    connectionString: validateDisposableDatabaseUrl(connectionString, database),
    connectionTimeoutMillis: 10_000,
  })
  try {
    await client.connect()
    const { rows } = await client.query(disposableDatabaseIdentityQuery)
    assertDisposableDatabaseIdentity(rows, database)
  } catch {
    throw new Error(
      'Refusing Prisma operation: disposable database identity or marker verification failed'
    )
  } finally {
    await client.end()
  }
}

export async function runGuardedPrisma(operation: string, args: string[]) {
  const command = guardedPrismaCommand(operation, args)
  assertNoPostgresEnvironmentOverrides()
  // Validate every writable destination before opening any connection.
  if (operation !== 'diff')
    validateDisposableDatabaseUrl(process.env.DATABASE_URL)
  if (operation === 'migrate' || operation === 'diff') {
    validateDisposableDatabaseUrl(
      process.env.SHADOW_DATABASE_URL,
      'klicker_test_shadow'
    )
  }
  if (operation !== 'diff')
    await verify(process.env.DATABASE_URL, 'klicker_test')
  if (operation === 'migrate' || operation === 'diff') {
    await verify(process.env.SHADOW_DATABASE_URL, 'klicker_test_shadow')
  }
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../node_modules/prisma/build/index.js', import.meta.url)
      ),
      ...command,
      '--config',
      fileURLToPath(new URL('../prisma.config.ts', import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: process.env,
      stdio: 'inherit',
    }
  )
  if (result.error || result.signal)
    throw new Error('Guarded Prisma process failed')
  return result.status ?? 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGuardedPrisma(process.argv[2] ?? '', process.argv.slice(3)).then(
    (status) => {
      process.exitCode = status
    },
    (error: Error) => {
      console.error(error.message)
      process.exitCode = 1
    }
  )
}
