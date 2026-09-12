// Shared by production-only entry points and contract tests.
import { createHash } from 'node:crypto'
import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'

export const IMPORT_EXPORT_OPERATION_SCHEMA_VERSION = 1 as const

export type ImportExportEnvironment = 'stg' | 'prd'
export type ImportExportDatabaseTarget = 'normal'

export class ImportExportOperationError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'ImportExportOperationError'
  }
}

export function parseOperationEnvironment(
  env: NodeJS.ProcessEnv = process.env
): ImportExportEnvironment {
  if (env.NODE_ENV !== 'production') {
    throw new ImportExportOperationError('PRODUCTION_MODE_REQUIRED')
  }
  if (env.IMPORT_EXPORT_ENVIRONMENT === 'stg') return 'stg'
  if (env.IMPORT_EXPORT_ENVIRONMENT === 'prd') return 'prd'
  throw new ImportExportOperationError('ENVIRONMENT_REQUIRED')
}

export function parseDatabaseTarget(
  env: NodeJS.ProcessEnv = process.env
): ImportExportDatabaseTarget {
  const target = env.IMPORT_EXPORT_DATABASE_TARGET ?? 'normal'
  if (target === 'normal') return target
  if (target === 'assessment') {
    throw new ImportExportOperationError(
      'ASSESSMENT_DATABASE_TARGET_UNSUPPORTED'
    )
  }
  throw new ImportExportOperationError('DATABASE_TARGET_INVALID')
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  parseDatabaseTarget(env)
  const value = env.DATABASE_URL
  if (!value) {
    throw new ImportExportOperationError('DATABASE_CONFIGURATION_MISSING')
  }
  return value
}

export function requireMasterGateOff(env: NodeJS.ProcessEnv = process.env) {
  const value = env.IMPORT_EXPORT_ENABLED
  if (typeof value === 'undefined' || value === 'false') return

  if (value === 'true') {
    throw new ImportExportOperationError('MASTER_GATE_MUST_BE_OFF')
  }

  throw new ImportExportOperationError('MASTER_GATE_INVALID')
}

export function parseBoundedInteger({
  name,
  defaultValue,
  minimum,
  maximum,
  env = process.env,
}: {
  name: string
  defaultValue: number
  minimum: number
  maximum: number
  env?: NodeJS.ProcessEnv
}) {
  const raw = env[name]
  if (typeof raw === 'undefined') return defaultValue
  if (!/^\d+$/.test(raw)) {
    throw new ImportExportOperationError('OPERATION_LIMIT_INVALID')
  }
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ImportExportOperationError('OPERATION_LIMIT_INVALID')
  }
  return parsed
}

export type OperationOutput = Readonly<{
  schemaVersion: typeof IMPORT_EXPORT_OPERATION_SCHEMA_VERSION
  operation: string
  environment: ImportExportEnvironment
  target: ImportExportDatabaseTarget
  outcome: 'success' | 'incomplete' | 'failure'
  code: string
  counts?: Readonly<Record<string, number>>
  checks?: Readonly<Record<string, boolean>>
  details?: Readonly<Record<string, unknown>>
}>

export function createOperationOutput(
  operation: string,
  fields: Omit<
    OperationOutput,
    'schemaVersion' | 'operation' | 'environment' | 'target'
  >,
  env: NodeJS.ProcessEnv = process.env
): OperationOutput {
  return {
    schemaVersion: IMPORT_EXPORT_OPERATION_SCHEMA_VERSION,
    operation,
    ...fields,
    environment: parseOperationEnvironment(env),
    target: parseDatabaseTarget(env),
  }
}

export function writeOperationOutput(
  output: OperationOutput,
  stream: Pick<NodeJS.WriteStream, 'write'> = process.stdout
) {
  stream.write(`${JSON.stringify(output)}\n`)
}

export async function runOperationCli(
  operation: string,
  run: () => Promise<OperationOutput>,
  dependencies: {
    stdout?: Pick<NodeJS.WriteStream, 'write'>
    stderr?: Pick<NodeJS.WriteStream, 'write'>
    env?: NodeJS.ProcessEnv
  } = {}
) {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  const env = dependencies.env ?? process.env
  try {
    const output = await run()
    writeOperationOutput(output, stdout)
    return output.outcome === 'success' ? 0 : 2
  } catch (error) {
    const code =
      error instanceof ImportExportOperationError
        ? error.code
        : 'OPERATION_FAILED'
    writeOperationOutput(
      createOperationOutput(
        operation,
        {
          outcome: 'failure',
          code,
        },
        {
          ...env,
          NODE_ENV: 'production',
          IMPORT_EXPORT_ENVIRONMENT: parseEnvironmentForFailure(env),
          IMPORT_EXPORT_DATABASE_TARGET: 'normal',
        }
      ),
      stderr
    )
    return 1
  }
}

function parseEnvironmentForFailure(
  env: NodeJS.ProcessEnv
): ImportExportEnvironment {
  return env.IMPORT_EXPORT_ENVIRONMENT === 'prd' ? 'prd' : 'stg'
}

const uuid = z.string().uuid()
const boundedNumberIds = z.array(z.number().int().positive()).max(5000)
const boundedUuidIds = z.array(uuid).max(5000)

export const ImportExportRecoveryManifestSchema = z
  .object({
    schemaVersion: z.literal(2),
    environment: z.enum(['stg', 'prd']),
    target: z.literal('normal'),
    databaseIdentity: z.string().regex(/^[a-f0-9]{64}$/),
    storageIdentity: z.string().regex(/^[a-f0-9]{64}$/),
    ownerId: uuid,
    phase: z.enum([
      'initialized',
      'active',
      'cleanup-reviewed',
      'clean',
      'recovery-required',
    ]),
    resources: z
      .object({
        elementIds: boundedNumberIds,
        answerCollectionIds: boundedNumberIds,
        mediaFileIds: boundedUuidIds,
        artifactIds: boundedUuidIds,
        receiptIds: boundedUuidIds,
        stagingIds: boundedUuidIds,
      })
      .strict(),
  })
  .strict()

export type ImportExportRecoveryManifest = z.infer<
  typeof ImportExportRecoveryManifestSchema
>

export function getImportExportStorageIdentity(
  env: NodeJS.ProcessEnv = process.env
) {
  const accountName = env.BLOB_STORAGE_ACCOUNT_NAME
  if (!accountName || !/^[a-z0-9]{3,24}$/.test(accountName)) {
    throw new ImportExportOperationError('STORAGE_IDENTITY_UNAVAILABLE')
  }
  return createHash('sha256').update(`azure-blob:${accountName}`).digest('hex')
}

const MAX_MANIFEST_BYTES = 1024 * 1024

export async function readRecoveryManifest(path: string) {
  const details = await stat(path)
  if (!details.isFile() || details.size > MAX_MANIFEST_BYTES) {
    throw new ImportExportOperationError('RECOVERY_MANIFEST_INVALID')
  }
  try {
    return ImportExportRecoveryManifestSchema.parse(
      JSON.parse(await readFile(path, 'utf8'))
    )
  } catch {
    throw new ImportExportOperationError('RECOVERY_MANIFEST_INVALID')
  }
}

export async function writeRecoveryManifest(
  path: string,
  manifest: ImportExportRecoveryManifest
) {
  const validated = ImportExportRecoveryManifestSchema.parse(manifest)
  const temporaryPath = join(
    dirname(path),
    `.import-export-recovery-${process.pid}.tmp`
  )
  await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await rename(temporaryPath, path)
}

export async function writeProtectedJson(
  path: string,
  value: Readonly<Record<string, unknown>>
) {
  const temporaryPath = join(
    dirname(path),
    `.import-export-operation-${process.pid}.tmp`
  )
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await rename(temporaryPath, path)
}

export function hashOpaqueProgress(value: string | number | undefined) {
  if (typeof value === 'undefined') return undefined
  return createHash('sha256').update(String(value)).digest('hex')
}
