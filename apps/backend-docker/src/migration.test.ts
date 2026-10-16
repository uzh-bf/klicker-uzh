import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { type Migration, migrate } from './migration.js'

interface FakeDatabase {
  records: Set<string>
  lockedIds: string[]
  findFirstFailures: unknown[]
}

function prismaError(code: string, message = code) {
  return Object.assign(new Error(message), { code })
}

// Minimal stand-in for the Prisma client surface the migration runner uses. The
// transaction helper rolls the migration records back when the callback throws,
// mirroring a failed PostgreSQL transaction.
function createFakePrisma(db: FakeDatabase) {
  const migration = {
    findFirst: async ({ where }: { where: { id: string } }) => {
      const failure = db.findFirstFailures.shift()
      if (failure !== undefined) throw failure
      return db.records.has(where.id) ? { id: where.id } : null
    },
    create: async ({ data }: { data: { id: string } }) => {
      if (db.records.has(data.id)) throw prismaError('P2002')
      db.records.add(data.id)
      return data
    },
  }

  const tx = {
    migration,
    $executeRaw: async (_strings: TemplateStringsArray, id: string) => {
      db.lockedIds.push(id)
      return 1
    },
  }

  const prisma = {
    migration,
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const snapshot = new Set(db.records)
      try {
        return await callback(tx)
      } catch (error) {
        db.records = snapshot
        throw error
      }
    },
  }

  return prisma as unknown as PrismaClient
}

function setup(migrations: Migration[]) {
  const db: FakeDatabase = {
    records: new Set(),
    lockedIds: [],
    findFirstFailures: [],
  }
  const prisma = createFakePrisma(db)
  const run = () =>
    migrate(prisma, { registry: migrations, retryBaseDelayMs: 1 })
  return { db, run }
}

describe('migrate', () => {
  it('applies a transactional migration once under the advisory lock', async (t) => {
    t.mock.method(console, 'log', () => {})
    let runs = 0
    const { db, run } = setup([
      {
        id: 'tx-migration',
        migrate: async () => {
          runs += 1
        },
      },
    ])

    await run()
    await run()

    assert.equal(runs, 1)
    assert.deepEqual([...db.records], ['tx-migration'])
    assert.deepEqual(db.lockedIds, ['tx-migration', 'tx-migration'])
  })

  it('propagates a unique constraint violation raised by the migration body', async (t) => {
    t.mock.method(console, 'log', () => {})
    const { db, run } = setup([
      {
        id: 'tx-migration',
        migrate: async () => {
          throw prismaError('P2002', 'Unique constraint failed')
        },
      },
    ])

    await assert.rejects(run, { code: 'P2002' })
    assert.equal(db.records.size, 0)
  })

  it('tolerates a concurrent record insert for an idempotent migration', async (t) => {
    t.mock.method(console, 'log', () => {})
    let runs = 0
    const { db, run } = setup([
      {
        id: 'idempotent-migration',
        isIdempotent: true,
        migrate: async () => {
          runs += 1
          // Another replica finishes and records the migration first.
          db.records.add('idempotent-migration')
        },
      },
    ])

    await run()

    assert.equal(runs, 1)
    assert.deepEqual([...db.records], ['idempotent-migration'])
  })

  it('retries transient database errors before applying the migration', async (t) => {
    t.mock.method(console, 'log', () => {})
    const warn = t.mock.method(console, 'warn', () => {})
    let runs = 0
    const { db, run } = setup([
      {
        id: 'tx-migration',
        migrate: async () => {
          runs += 1
        },
      },
    ])
    db.findFirstFailures.push(
      prismaError('P1001', "Can't reach database server at db:5432"),
      prismaError('P2028', 'Transaction API error: expired transaction')
    )

    await run()

    assert.equal(runs, 1)
    assert.equal(warn.mock.callCount(), 2)
    assert.deepEqual([...db.records], ['tx-migration'])
  })

  it('fails fast on non-transient errors', async (t) => {
    t.mock.method(console, 'log', () => {})
    const warn = t.mock.method(console, 'warn', () => {})
    const { db, run } = setup([
      {
        id: 'tx-migration',
        migrate: async () => {
          throw new Error('column "foo" does not exist')
        },
      },
    ])

    await assert.rejects(run, /column "foo" does not exist/)
    assert.equal(warn.mock.callCount(), 0)
    assert.equal(db.records.size, 0)
  })

  it('gives up after the retry budget is exhausted', async (t) => {
    t.mock.method(console, 'log', () => {})
    const warn = t.mock.method(console, 'warn', () => {})
    const { db, run } = setup([{ id: 'tx-migration', migrate: async () => {} }])
    db.findFirstFailures.push(
      prismaError('P1001'),
      prismaError('P1001'),
      prismaError('P1001')
    )

    await assert.rejects(run, { code: 'P1001' })
    assert.equal(warn.mock.callCount(), 2)
    assert.equal(db.records.size, 0)
  })
})
