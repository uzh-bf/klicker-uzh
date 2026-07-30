import {
  Prisma,
  PrismaClient,
  type PrismaClient as PrismaClientType,
} from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import assert from 'node:assert/strict'

const PROTOTYPE_SCHEMA = 'permission_propagation_prototype'
const RECOVERY_SLO_MS = 5 * 60 * 1000
const RECONCILIATION_CADENCE_MS = 60 * 1000
const DRY_RUN = process.env.DRY_RUN !== 'false'

type Client = PrismaClientType
type Transaction = Prisma.TransactionClient
type WorkRow = {
  scope_key: string
  principal_key: string
  generation: bigint
  processed_generation: bigint
  dispatched_generation: bigint
  dirty_at: Date
  recover_by: Date
}
type WorkerInput = {
  scopeKey: string
  taskGeneration: bigint
}
type TransactionHooks = {
  beforeLock?: (backendPid: number) => void
  afterLock?: () => void
}
type WorkerHooks = TransactionHooks & {
  afterRead?: () => Promise<void>
}

function assertDisposableLocalDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.')
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The permission propagation prototype rejects NODE_ENV=production.'
    )
  }
  if (process.env.PERMISSION_PROPAGATION_PROTOTYPE !== '1') {
    throw new Error('The permission propagation prototype is opt-in.')
  }
  if (process.env.PERMISSION_PROPAGATION_PROTOTYPE_CONFIRM_LOCAL !== '1') {
    throw new Error(
      'Set PERMISSION_PROPAGATION_PROTOTYPE_CONFIRM_LOCAL=1 to confirm that DATABASE_URL targets a disposable local database.'
    )
  }

  const hostname = new URL(databaseUrl).hostname
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres'])
  if (!allowedHosts.has(hostname) && !hostname.endsWith('.localhost')) {
    throw new Error(
      `The permission propagation prototype only runs against a local database; received host "${hostname}".`
    )
  }
}

function createClient(databaseUrl: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function contractSummary(status: 'dry-run' | 'passed') {
  return {
    prototype: 'permission-propagation-contract',
    databaseFence: 'global PostgreSQL transaction advisory lock',
    durableDelivery: 'monotonic generation with at-least-once dispatch',
    recoverySloMs: RECOVERY_SLO_MS,
    reconciliationCadenceMs: RECONCILIATION_CADENCE_MS,
    scenarios: [
      'atomic source and durable work rollback',
      'grant worker versus synchronous revoke',
      'different roots overlapping one derived row',
      'commit before enqueue recovery and duplicate delivery',
      'persistent failure sink with unresolved work',
    ],
    status,
  }
}

async function initializePrototypeSchema(
  prisma: Client,
  onSchemaCreated: () => void
) {
  const existing = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.schemata
      WHERE schema_name = ${PROTOTYPE_SCHEMA}
    ) AS "exists"
  `
  assert.equal(
    existing[0]?.exists,
    false,
    `Refusing to overwrite existing schema "${PROTOTYPE_SCHEMA}".`
  )

  await prisma.$executeRaw`
    CREATE SCHEMA "permission_propagation_prototype"
  `
  onSchemaCreated()
  await prisma.$executeRaw`
    CREATE TABLE "permission_propagation_prototype"."source_state" (
      "scope_key" TEXT PRIMARY KEY,
      "principal_key" TEXT NOT NULL,
      "granted" BOOLEAN NOT NULL,
      "updated_at" TIMESTAMPTZ NOT NULL
    )
  `
  await prisma.$executeRaw`
    CREATE TABLE "permission_propagation_prototype"."derived_state" (
      "principal_key" TEXT PRIMARY KEY,
      "granted" BOOLEAN NOT NULL,
      "source_scope_key" TEXT NOT NULL,
      "generation" BIGINT NOT NULL
    )
  `
  await prisma.$executeRaw`
    CREATE TABLE "permission_propagation_prototype"."work" (
      "scope_key" TEXT PRIMARY KEY,
      "principal_key" TEXT NOT NULL,
      "object_type" TEXT NOT NULL,
      "object_id" TEXT NOT NULL,
      "mode" TEXT NOT NULL,
      "user_id" TEXT,
      "generation" BIGINT NOT NULL,
      "processed_generation" BIGINT NOT NULL DEFAULT 0,
      "dispatched_generation" BIGINT NOT NULL DEFAULT 0,
      "dirty_at" TIMESTAMPTZ NOT NULL,
      "recover_by" TIMESTAMPTZ NOT NULL,
      CONSTRAINT "work_generation_order" CHECK (
        "processed_generation" <= "generation"
        AND "dispatched_generation" <= "generation"
      )
    )
  `
  await prisma.$executeRaw`
    CREATE TABLE "permission_propagation_prototype"."failure" (
      "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      "scope_key" TEXT NOT NULL,
      "generation" BIGINT NOT NULL,
      "failure_code" TEXT NOT NULL,
      "failed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
}

async function cleanupPrototypeSchema(prisma: Client) {
  await prisma.$executeRaw`
    DROP SCHEMA "permission_propagation_prototype" CASCADE
  `
}

async function acquireFence(tx: Transaction, hooks: TransactionHooks = {}) {
  const backend = await tx.$queryRaw<{ pid: number }[]>`
    SELECT pg_backend_pid() AS "pid"
  `
  const backendPid = backend[0]?.pid
  assert.ok(backendPid, 'The PostgreSQL backend PID is required.')
  hooks.beforeLock?.(backendPid)

  // Slice 4 reserves one application-level namespace/key pair. Every source
  // mutation and propagation worker must acquire it first in its transaction.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(5144, 1)
  `
  hooks.afterLock?.()
}

async function upsertSourceAndWork(
  tx: Transaction,
  input: {
    scopeKey: string
    principalKey: string
    objectType: string
    objectId: string
    mode: 'OBJECT' | 'USER'
    userId?: string
    granted: boolean
    dirtyAt: Date
  }
) {
  const recoverBy = new Date(input.dirtyAt.getTime() + RECOVERY_SLO_MS)

  await tx.$executeRaw`
    INSERT INTO "permission_propagation_prototype"."source_state" (
      "scope_key",
      "principal_key",
      "granted",
      "updated_at"
    )
    VALUES (
      ${input.scopeKey},
      ${input.principalKey},
      ${input.granted},
      ${input.dirtyAt}
    )
    ON CONFLICT ("scope_key") DO UPDATE
    SET
      "principal_key" = EXCLUDED."principal_key",
      "granted" = EXCLUDED."granted",
      "updated_at" = EXCLUDED."updated_at"
  `

  const work = await tx.$queryRaw<WorkRow[]>`
    INSERT INTO "permission_propagation_prototype"."work" (
      "scope_key",
      "principal_key",
      "object_type",
      "object_id",
      "mode",
      "user_id",
      "generation",
      "dirty_at",
      "recover_by"
    )
    VALUES (
      ${input.scopeKey},
      ${input.principalKey},
      ${input.objectType},
      ${input.objectId},
      ${input.mode},
      ${input.userId ?? null},
      1,
      ${input.dirtyAt},
      ${recoverBy}
    )
    ON CONFLICT ("scope_key") DO UPDATE
    SET
      "principal_key" = EXCLUDED."principal_key",
      "object_type" = EXCLUDED."object_type",
      "object_id" = EXCLUDED."object_id",
      "mode" = EXCLUDED."mode",
      "user_id" = EXCLUDED."user_id",
      "generation" =
        "permission_propagation_prototype"."work"."generation" + 1,
      "dirty_at" = EXCLUDED."dirty_at",
      "recover_by" = EXCLUDED."recover_by"
    RETURNING *
  `

  assert.ok(work[0], 'The durable work row is required.')
  return work[0]
}

async function rederivePrincipal(
  tx: Transaction,
  principalKey: string,
  generation: bigint
) {
  const activeSources = await tx.$queryRaw<{ scope_key: string }[]>`
    SELECT "scope_key"
    FROM "permission_propagation_prototype"."source_state"
    WHERE
      "principal_key" = ${principalKey}
      AND "granted" = true
    ORDER BY "scope_key" ASC
  `
  const sourceScopeKey = activeSources[0]?.scope_key

  if (!sourceScopeKey) {
    await tx.$executeRaw`
      DELETE FROM "permission_propagation_prototype"."derived_state"
      WHERE "principal_key" = ${principalKey}
    `
    return
  }

  await tx.$executeRaw`
    INSERT INTO "permission_propagation_prototype"."derived_state" (
      "principal_key",
      "granted",
      "source_scope_key",
      "generation"
    )
    VALUES (${principalKey}, true, ${sourceScopeKey}, ${generation})
    ON CONFLICT ("principal_key") DO UPDATE
    SET
      "granted" = EXCLUDED."granted",
      "source_scope_key" = EXCLUDED."source_scope_key",
      "generation" = EXCLUDED."generation"
  `
}

async function mutateSource(
  prisma: Client,
  input: {
    scopeKey: string
    principalKey: string
    objectType: string
    objectId: string
    mode?: 'OBJECT' | 'USER'
    userId?: string
    granted: boolean
    dirtyAt?: Date
    rederiveSynchronously?: boolean
    failAfterDurableWrite?: boolean
  },
  hooks: TransactionHooks = {}
) {
  return prisma.$transaction(
    async (tx) => {
      await acquireFence(tx, hooks)
      const work = await upsertSourceAndWork(tx, {
        ...input,
        mode: input.mode ?? 'OBJECT',
        dirtyAt: input.dirtyAt ?? new Date(),
      })

      if (input.failAfterDurableWrite) {
        throw new Error('synthetic_atomic_rollback')
      }
      if (input.rederiveSynchronously) {
        await rederivePrincipal(tx, input.principalKey, work.generation)
      }
      return work
    },
    { maxWait: 10_000, timeout: 30_000 }
  )
}

async function runWorker(
  prisma: Client,
  input: WorkerInput,
  hooks: WorkerHooks = {},
  failAfterRead = false
) {
  return prisma.$transaction(
    async (tx) => {
      await acquireFence(tx, hooks)
      const work = await tx.$queryRaw<WorkRow[]>`
        SELECT *
        FROM "permission_propagation_prototype"."work"
        WHERE "scope_key" = ${input.scopeKey}
        FOR UPDATE
      `
      const current = work[0]
      assert.ok(current, `Missing durable work "${input.scopeKey}".`)
      assert.ok(
        input.taskGeneration <= current.generation,
        'A task cannot observe a future work generation.'
      )

      if (current.processed_generation >= current.generation) {
        return { outcome: 'noop' as const, generation: current.generation }
      }

      const sourceSnapshot = await tx.$queryRaw<{ granted: boolean }[]>`
        SELECT "granted"
        FROM "permission_propagation_prototype"."source_state"
        WHERE "scope_key" = ${input.scopeKey}
      `
      assert.ok(sourceSnapshot[0], `Missing source "${input.scopeKey}".`)
      await hooks.afterRead?.()

      if (failAfterRead) {
        throw new Error('synthetic_worker_failure')
      }

      await rederivePrincipal(tx, current.principal_key, current.generation)
      await tx.$executeRaw`
        UPDATE "permission_propagation_prototype"."work"
        SET "processed_generation" = ${current.generation}
        WHERE
          "scope_key" = ${input.scopeKey}
          AND "generation" = ${current.generation}
      `

      return { outcome: 'processed' as const, generation: current.generation }
    },
    { maxWait: 10_000, timeout: 30_000 }
  )
}

async function runWorkerWithFailureSink(prisma: Client, input: WorkerInput) {
  try {
    return await runWorker(prisma, input, {}, true)
  } catch {
    await prisma.$executeRaw`
      INSERT INTO "permission_propagation_prototype"."failure" (
        "scope_key",
        "generation",
        "failure_code"
      )
      VALUES (
        ${input.scopeKey},
        ${input.taskGeneration},
        'WORKER_EXECUTION_FAILED'
      )
    `
    return null
  }
}

async function markDispatchedAfterAcceptedEnqueue(
  prisma: Client,
  input: WorkerInput
) {
  await prisma.$executeRaw`
    UPDATE "permission_propagation_prototype"."work"
    SET "dispatched_generation" = GREATEST(
      "dispatched_generation",
      ${input.taskGeneration}
    )
    WHERE "scope_key" = ${input.scopeKey}
  `
}

async function getWork(prisma: Client, scopeKey: string) {
  const rows = await prisma.$queryRaw<WorkRow[]>`
    SELECT *
    FROM "permission_propagation_prototype"."work"
    WHERE "scope_key" = ${scopeKey}
  `
  assert.ok(rows[0], `Missing work row "${scopeKey}".`)
  return rows[0]
}

async function getDerived(prisma: Client, principalKey: string) {
  return prisma.$queryRaw<
    {
      principal_key: string
      granted: boolean
      source_scope_key: string
      generation: bigint
    }[]
  >`
    SELECT *
    FROM "permission_propagation_prototype"."derived_state"
    WHERE "principal_key" = ${principalKey}
  `
}

async function findReconciliationCandidates(prisma: Client, observedAt: Date) {
  const cutoff = new Date(observedAt.getTime() - RECONCILIATION_CADENCE_MS)
  return prisma.$queryRaw<WorkRow[]>`
    SELECT *
    FROM "permission_propagation_prototype"."work"
    WHERE
      "processed_generation" < "generation"
      AND "dirty_at" <= ${cutoff}
    ORDER BY "scope_key" ASC
  `
}

async function waitForBlockedAdvisoryLock(
  observer: Client,
  backendPid: number
) {
  const deadline = performance.now() + 5_000
  while (performance.now() < deadline) {
    const locks = await observer.$queryRaw<{ granted: boolean }[]>`
      SELECT "granted"
      FROM pg_locks
      WHERE
        "pid" = ${backendPid}
        AND "locktype" = 'advisory'
    `
    if (locks.some((lock) => !lock.granted)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(
    `Backend ${backendPid} did not block on the shared advisory lock.`
  )
}

async function proveAtomicSourceAndDirtyWrite(prisma: Client) {
  const input = {
    scopeKey: 'atomic-course',
    principalKey: 'principal-atomic',
    objectType: 'COURSE',
    objectId: 'atomic-course',
    granted: true,
  }

  await assert.rejects(
    mutateSource(prisma, { ...input, failAfterDurableWrite: true }),
    /synthetic_atomic_rollback/
  )
  const afterRollback = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS "count"
    FROM (
      SELECT "scope_key"
      FROM "permission_propagation_prototype"."source_state"
      WHERE "scope_key" = ${input.scopeKey}
      UNION ALL
      SELECT "scope_key"
      FROM "permission_propagation_prototype"."work"
      WHERE "scope_key" = ${input.scopeKey}
    ) AS "rolled_back_rows"
  `
  assert.equal(afterRollback[0]?.count, 0n)

  const committed = await mutateSource(prisma, input)
  assert.equal(committed.generation, 1n)
  assert.equal(committed.processed_generation, 0n)
}

async function proveGrantWorkerRevokeRace(
  workerClient: Client,
  mutationClient: Client,
  observer: Client
) {
  const scopeKey = 'race-course'
  const principalKey = 'principal-race'
  const initial = await mutateSource(workerClient, {
    scopeKey,
    principalKey,
    objectType: 'COURSE',
    objectId: scopeKey,
    granted: true,
  })
  const workerLocked = deferred()
  const releaseWorker = deferred()
  const revokeWaiting = deferred()
  let revokeBackendPid = 0

  const worker = runWorker(
    workerClient,
    { scopeKey, taskGeneration: initial.generation },
    {
      afterLock: workerLocked.resolve,
      afterRead: () => releaseWorker.promise,
    }
  )
  await workerLocked.promise

  const revoke = mutateSource(
    mutationClient,
    {
      scopeKey,
      principalKey,
      objectType: 'COURSE',
      objectId: scopeKey,
      granted: false,
      rederiveSynchronously: true,
    },
    {
      beforeLock(backendPid) {
        revokeBackendPid = backendPid
        revokeWaiting.resolve()
      },
    }
  )
  await revokeWaiting.promise
  await waitForBlockedAdvisoryLock(observer, revokeBackendPid)

  releaseWorker.resolve()
  await worker
  const revoked = await revoke
  assert.equal(revoked.generation, 2n)
  assert.deepEqual(await getDerived(observer, principalKey), [])

  const coalesced = await runWorker(workerClient, {
    scopeKey,
    taskGeneration: initial.generation,
  })
  assert.deepEqual(coalesced, { outcome: 'processed', generation: 2n })
  assert.deepEqual(await getDerived(observer, principalKey), [])

  const duplicate = await runWorker(workerClient, {
    scopeKey,
    taskGeneration: initial.generation,
  })
  assert.deepEqual(duplicate, { outcome: 'noop', generation: 2n })
}

async function proveOverlappingRootsSerialize(
  firstWorkerClient: Client,
  secondWorkerClient: Client,
  observer: Client
) {
  const principalKey = 'principal-overlap'
  const course = await mutateSource(firstWorkerClient, {
    scopeKey: 'overlap-course',
    principalKey,
    objectType: 'COURSE',
    objectId: 'overlap-course',
    granted: true,
  })
  const activity = await mutateSource(firstWorkerClient, {
    scopeKey: 'overlap-activity',
    principalKey,
    objectType: 'LIVE_QUIZ',
    objectId: 'overlap-activity',
    granted: false,
  })
  const firstLocked = deferred()
  const releaseFirst = deferred()
  const secondWaiting = deferred()
  let secondBackendPid = 0

  const firstWorker = runWorker(
    firstWorkerClient,
    {
      scopeKey: course.scope_key,
      taskGeneration: course.generation,
    },
    {
      afterLock: firstLocked.resolve,
      afterRead: () => releaseFirst.promise,
    }
  )
  await firstLocked.promise

  const secondWorker = runWorker(
    secondWorkerClient,
    {
      scopeKey: activity.scope_key,
      taskGeneration: activity.generation,
    },
    {
      beforeLock(backendPid) {
        secondBackendPid = backendPid
        secondWaiting.resolve()
      },
    }
  )
  await secondWaiting.promise
  await waitForBlockedAdvisoryLock(observer, secondBackendPid)

  releaseFirst.resolve()
  await Promise.all([firstWorker, secondWorker])

  const derived = await getDerived(observer, principalKey)
  assert.equal(derived.length, 1)
  assert.equal(derived[0]?.granted, true)
  assert.equal(derived[0]?.source_scope_key, course.scope_key)
}

async function proveCommitBeforeEnqueueRecovery(
  workerClient: Client,
  observer: Client
) {
  const dirtyAt = new Date(Date.now() - 2 * RECONCILIATION_CADENCE_MS)
  const scopeKey = 'recovery-course'
  const principalKey = 'principal-recovery'
  const work = await mutateSource(workerClient, {
    scopeKey,
    principalKey,
    objectType: 'COURSE',
    objectId: scopeKey,
    granted: true,
    dirtyAt,
  })
  assert.equal(work.dispatched_generation, 0n)
  assert.equal(work.processed_generation, 0n)

  const observedAt = new Date(dirtyAt.getTime() + RECONCILIATION_CADENCE_MS)
  const candidates = await findReconciliationCandidates(observer, observedAt)
  assert.ok(
    candidates.some((candidate) => candidate.scope_key === scopeKey),
    'The first reconciliation cadence must rediscover a missed enqueue.'
  )

  const input = { scopeKey, taskGeneration: work.generation }
  await runWorker(workerClient, input)
  await markDispatchedAfterAcceptedEnqueue(observer, input)

  const recovered = await getWork(observer, scopeKey)
  assert.equal(recovered.processed_generation, recovered.generation)
  assert.equal(recovered.dispatched_generation, recovered.generation)
  assert.equal(
    recovered.recover_by.getTime() - recovered.dirty_at.getTime(),
    RECOVERY_SLO_MS
  )
  assert.equal((await getDerived(observer, principalKey)).length, 1)
}

async function provePersistentFailureSink(
  workerClient: Client,
  observer: Client
) {
  const dirtyAt = new Date(Date.now() - 2 * RECONCILIATION_CADENCE_MS)
  const scopeKey = 'failure-course'
  const principalKey = 'principal-failure'
  const work = await mutateSource(workerClient, {
    scopeKey,
    principalKey,
    objectType: 'COURSE',
    objectId: scopeKey,
    granted: true,
    dirtyAt,
  })

  const failed = await runWorkerWithFailureSink(workerClient, {
    scopeKey,
    taskGeneration: work.generation,
  })
  assert.equal(failed, null)

  const unresolved = await getWork(observer, scopeKey)
  assert.equal(unresolved.processed_generation, 0n)
  assert.equal(unresolved.generation, 1n)
  const failures = await observer.$queryRaw<
    { generation: bigint; failure_code: string }[]
  >`
    SELECT "generation", "failure_code"
    FROM "permission_propagation_prototype"."failure"
    WHERE "scope_key" = ${scopeKey}
  `
  assert.deepEqual(failures, [
    { generation: 1n, failure_code: 'WORKER_EXECUTION_FAILED' },
  ])

  const observedAt = new Date(dirtyAt.getTime() + RECONCILIATION_CADENCE_MS)
  const candidates = await findReconciliationCandidates(observer, observedAt)
  assert.ok(
    candidates.some((candidate) => candidate.scope_key === scopeKey),
    'Failed work must remain eligible for reconciliation.'
  )
  await runWorker(workerClient, {
    scopeKey,
    taskGeneration: work.generation,
  })
  assert.equal((await getWork(observer, scopeKey)).processed_generation, 1n)
}

async function main() {
  if (DRY_RUN) {
    console.log(JSON.stringify(contractSummary('dry-run')))
    return
  }

  assertDisposableLocalDatabase(process.env.DATABASE_URL)
  const databaseUrl = process.env.DATABASE_URL!
  const clients = [
    createClient(databaseUrl),
    createClient(databaseUrl),
    createClient(databaseUrl),
  ]
  const [firstClient, secondClient, observer] = clients
  assert.ok(firstClient && secondClient && observer)
  let schemaCreated = false

  try {
    await initializePrototypeSchema(observer, () => {
      schemaCreated = true
    })
    await proveAtomicSourceAndDirtyWrite(firstClient)
    await proveGrantWorkerRevokeRace(firstClient, secondClient, observer)
    await proveOverlappingRootsSerialize(firstClient, secondClient, observer)
    await proveCommitBeforeEnqueueRecovery(firstClient, observer)
    await provePersistentFailureSink(firstClient, observer)

    console.log(JSON.stringify(contractSummary('passed')))
  } finally {
    try {
      if (schemaCreated) {
        await cleanupPrototypeSchema(observer)
      }
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
