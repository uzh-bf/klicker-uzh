import { Prisma } from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, test } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  cancelCapability,
  consumeCapability,
  expireStaleCapabilities,
  reserveCapability,
  settleCapability,
} from '../src/services/byokReservations.js'

// ---------------------------------------------------------------------------
// In-memory Prisma fake covering exactly the operations the service uses.
// Enforces the same unique constraints as PostgreSQL for concurrency tests.
// ---------------------------------------------------------------------------

type Row = Record<string, any>

function makeDb() {
  const tables = {
    chatbotProviderBinding: [] as Row[],
    providerCredential: [] as Row[],
    byokUsageAccount: [] as Row[],
    byokCapability: [] as Row[],
    providerProfile: [] as Row[],
  }
  let idc = 0
  const nid = () => {
    idc++
    return 'id-' + idc.toString().padStart(6, '0')
  }

  function find(t: Row[], pred: (r: Row) => boolean): Row | null {
    return t.find(pred) ?? null
  }

  function sumReserved(where: {
    bindingId?: string
    participantId?: string
  }): any {
    return tables.byokUsageAccount
      .filter((r) => {
        if (where.bindingId && r.bindingId !== where.bindingId) return false
        if (where.participantId && r.participantId !== where.participantId)
          return false
        return true
      })
      .reduce(
        (acc, r) => acc.plus(new Prisma.Decimal(r.reservedAmount)),
        new Prisma.Decimal(0)
      )
  }

  const db = {
    chatbotProviderBinding: {
      findUnique: async ({ where }: any) => {
        const row = find(
          tables.chatbotProviderBinding,
          (r) => r.id === where.id
        )
        if (row && row.credentialId) {
          const cred =
            tables.providerCredential.find((c) => c.id === row.credentialId) ??
            null
          if (cred && cred.profileId) {
            cred.profile =
              tables.providerProfile.find((pr) => pr.id === cred.profileId) ??
              null
          }
          row.credential = cred
        }
        return row
      },
    },
    providerCredential: {
      findUnique: async ({ where }: any) =>
        find(tables.providerCredential, (r) => r.id === where.id),
    },
    byokUsageAccount: {
      aggregate: async ({ where }: any) =>
        ({
          _sum: { reservedAmount: sumReserved(where) },
        }) as any,
      create: async ({ data }: any) => {
        const row = {
          id: nid(),
          usedAmount: 0,
          isSettled: false,
          settledAt: null,
          requestTraceId: null,
          currency: data.currency ?? 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }
        tables.byokUsageAccount.push(row)
        return row
      },
      findUnique: async ({ where }: any) =>
        find(tables.byokUsageAccount, (r) => r.id === where.id),
      update: async ({ where, data }: any) => {
        const row = find(tables.byokUsageAccount, (r) => r.id === where.id)!
        Object.assign(row, data, { updatedAt: new Date() })
        return row
      },
    },
    byokCapability: {
      findUnique: async ({ where }: any) => {
        if (where.bearerHash)
          return find(
            tables.byokCapability,
            (r) => r.bearerHash === where.bearerHash
          )
        if (where.id)
          return find(tables.byokCapability, (r) => r.id === where.id)
        return null
      },
      create: async ({ data }: any) => {
        if (
          tables.byokCapability.some((r) => r.bearerHash === data.bearerHash)
        ) {
          throw new Error('UNIQUE_BEARER_HASH')
        }
        const row = {
          id: nid(),
          consumedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }
        tables.byokCapability.push(row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = find(tables.byokCapability, (r) => r.id === where.id)!
        Object.assign(row, data, { updatedAt: new Date() })
        return row
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0
        for (const r of tables.byokCapability) {
          if (
            Array.isArray(where.status?.in)
              ? where.status.in.includes(r.status)
              : r.status === where.status
          ) {
            const expiredCheck =
              !where.expiresAt ||
              new Date(r.expiresAt).getTime() <=
                ((where.expiresAt as any).lte?.getTime?.() ?? Infinity)
            if (expiredCheck) {
              Object.assign(r, data, { updatedAt: new Date() })
              count++
            }
          }
        }
        return { count }
      },
    },
    // Serialized transaction: queues callbacks so concurrent callers see
    // each other's writes, matching PostgreSQL serializable behavior.
    ...(() => {
      let txQueue = Promise.resolve()
      return {
        $transaction: async (fn: (db: unknown) => unknown, _opts?: unknown) => {
          const result = txQueue.then(() => fn(db))
          txQueue = result.catch(() => {})
          return result
        },
      }
    })(),
  }

  // Seed helpers
  function seedCredential(status = 'ACTIVE') {
    if (tables.providerProfile.length === 0) {
      tables.providerProfile.push({
        id: 'profile-1',
        key: 'uzh-azure-openai',
        version: 1,
      })
    }
    // Ensure a providerProfile exists for the credential to reference
    if (!tables.providerProfile) tables.providerProfile = []
    if (tables.providerProfile.length === 0) {
      tables.providerProfile.push({
        id: 'profile-1',
        key: 'uzh-azure-openai',
        version: 1,
      })
    }
    const cred = {
      id: nid(),
      ownerId: 'owner-1',
      status,
      vaultSecretVersion: 1,
      profileId: 'profile-1',
    }
    tables.providerCredential.push(cred)
    return cred
  }

  function seedBinding(credId: string, opts?: Partial<Row>) {
    const b = {
      id: nid(),
      credentialId: credId,
      chatbotId: 'bot-1',
      ownerId: 'owner-1',
      allowedModelAlias: 'gpt-5.6-luna',
      isActive: true,
      participantQuotaLimit: 10,
      aggregateQuotaLimit: 100,
      currentNoticeVersion: 1,
      ...opts,
    }
    tables.chatbotProviderBinding.push(b)
    return b
  }

  function ctx(): ContextWithUser {
    return {
      prisma: db,
      user: { sub: 'owner-1' },
    } as unknown as ContextWithUser
  }

  return { tables, db, ctx, seedCredential, seedBinding }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BYOK reservations', () => {
  let d: ReturnType<typeof makeDb>

  beforeEach(() => {
    d = makeDb()
  })

  test('happy path: reserve then consume returns full scope', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id)
    const result = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.50',
      },
      d.ctx()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.issued.token).toBeDefined()
    expect(result.issued.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const consumeResult = await consumeCapability(result.issued.token, d.ctx())
    expect(consumeResult.ok).toBe(true)
    if (!consumeResult.ok) return
    expect(consumeResult.scope.allowedModelAlias).toBe('gpt-5.6-luna')
    expect(consumeResult.scope.ownerId).toBe('owner-1')
  })

  test('replay of consumed capability fails', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id)
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.10',
      },
      d.ctx()
    )
    if (!res.ok) throw new Error('setup failed')

    await consumeCapability(res.issued.token, d.ctx())
    const replay = await consumeCapability(res.issued.token, d.ctx())
    expect(replay.ok).toBe(false)
    if (!replay.ok) expect(replay.reason).toBe('REPLAY_DETECTED')
  })

  test('participant cap exceeded blocks reservation', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id, { participantQuotaLimit: 1 })

    const first = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.60',
      },
      d.ctx()
    )
    expect(first.ok).toBe(true)

    const second = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.60',
      },
      d.ctx()
    )
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe('PARTICIPANT_CAP_EXCEEDED')
  })

  test('aggregate cap exceeded blocks reservation across participants', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id, { aggregateQuotaLimit: 2 })

    const p1 = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '1.00',
      },
      d.ctx()
    )
    expect(p1.ok).toBe(true)

    const p2 = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p2',
        estimatedCost: '1.00',
      },
      d.ctx()
    )
    expect(p2.ok).toBe(true)

    const p3 = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p3',
        estimatedCost: '0.01',
      },
      d.ctx()
    )
    expect(p3.ok).toBe(false)
    if (!p3.ok) expect(p3.reason).toBe('AGGREGATE_CAP_EXCEEDED')
  })

  test('inactive binding fails closed', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id, { isActive: false })
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.10',
      },
      d.ctx()
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('BINDING_INACTIVE')
  })

  test('non-active credential fails closed', async () => {
    const cred = d.seedCredential('SUSPENDED')
    const binding = d.seedBinding(cred.id)
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.10',
      },
      d.ctx()
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('CREDENTIAL_NOT_ACTIVE')
  })

  test('settle moves reserved to used idempotently', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id)
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.50',
      },
      d.ctx()
    )
    if (!res.ok) throw new Error('setup failed')

    const consume = await consumeCapability(res.issued.token, d.ctx())
    if (!consume.ok) throw new Error('consume failed')

    const firstSettle = await settleCapability(
      consume.scope.tokenId,
      '0.45',
      d.ctx()
    )
    expect(firstSettle.settled).toBe(true)

    // Second settle is a no-op.
    const secondSettle = await settleCapability(
      consume.scope.tokenId,
      '0.45',
      d.ctx()
    )
    expect(secondSettle.settled).toBe(false)

    const acct = d.tables.byokUsageAccount[0]!
    expect(Number(acct.usedAmount)).toBeCloseTo(0.45)
    expect(Number(acct.reservedAmount)).toBe(0)
    expect(acct.isSettled).toBe(true)
  })

  test('cancel releases reserved amount', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id)
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '5.00',
      },
      d.ctx()
    )
    if (!res.ok) throw new Error('setup failed')

    const cancelled = await cancelCapability(res.issued.tokenId, d.ctx())
    expect(cancelled).toBe(true)

    const acct = d.tables.byokUsageAccount[0]!
    expect(Number(acct.reservedAmount)).toBe(0)
    expect(acct.isSettled).toBe(false)

    // After cancellation, a new reservation within quota succeeds.
    const next = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '5.00',
      },
      d.ctx()
    )
    expect(next.ok).toBe(true)
  })

  test('expireStale marks overdue capabilities EXPIRED', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id)
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.50',
      },
      d.ctx()
    )
    if (!res.ok) throw new Error('setup failed')

    // Force expiration by backdating.
    d.tables.byokCapability[0]!.expiresAt = new Date(Date.now() - 1000)

    const count = await expireStaleCapabilities(d.ctx())
    expect(count).toBe(1)
    expect(d.tables.byokCapability[0]!.status).toBe('EXPIRED')
  })

  test('concurrent reserves cannot exceed aggregate cap', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id, { aggregateQuotaLimit: 1.0 })

    // Fire 5 concurrent requests each requesting 0.30 against cap 1.00.
    // Only floor(1.0 / 0.3) = 3 should succeed; the rest must fail.
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        reserveCapability(
          {
            bindingId: binding.id,
            chatbotId: 'bot-1',
            participantId: 'p' + i,
            estimatedCost: '0.30',
          },
          d.ctx()
        )
      )
    )

    const succeeded = results.filter((r) => r.ok)
    const failed = results.filter((r) => !r.ok)
    // With our in-memory serial transaction all run sequentially so we get
    // exactly 3 successes before the aggregate cap rejects further attempts.
    expect(succeeded.length).toBe(3)
    expect(failed.length).toBe(2)
    failed.forEach((f) => {
      if (!f.ok) expect(f.reason).toBe('AGGREGATE_CAP_EXCEEDED')
    })
  })

  test('bearer hash never stores raw token', async () => {
    const cred = d.seedCredential()
    const binding = d.seedBinding(cred.id)
    const res = await reserveCapability(
      {
        bindingId: binding.id,
        chatbotId: 'bot-1',
        participantId: 'p1',
        estimatedCost: '0.50',
      },
      d.ctx()
    )
    if (!res.ok) throw new Error('setup failed')

    const stored = d.tables.byokCapability[0]!
    expect(stored.bearerHash).not.toBe(res.issued.token)
    expect(stored.bearerHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(d.tables)).not.toContain(res.issued.token)
  })
})
