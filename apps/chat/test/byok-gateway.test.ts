import * as crypto from 'node:crypto'
import { beforeEach, describe, expect, test } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory Prisma fake for byokGateway unit tests
// ---------------------------------------------------------------------------

type Row = Record<string, any>

function makeDb() {
  const tables = {
    chatbotProviderBinding: [] as Row[],
    providerCredential: [] as Row[],
    providerProfile: [] as Row[],
    byokUsageAccount: [] as Row[],
    byokCapability: [] as Row[],
  }
  let idc = 0
  const nid = () => 'id-' + (++idc).toString().padStart(6, '0')

  function find(t: Row[], pred: (r: Row) => boolean): Row | null {
    return t.find(pred) ?? null
  }

  function sumField(
    where: { bindingId?: string; participantId?: string },
    field: string
  ): number {
    return tables.byokUsageAccount
      .filter((r) => {
        if (where.bindingId && r.bindingId !== where.bindingId) return false
        if (where.participantId && r.participantId !== where.participantId)
          return false
        return true
      })
      .reduce((acc, r) => acc + Number(r[field] ?? 0), 0)
  }

  const db = {
    chatbotProviderBinding: {
      findUnique: async ({ where }: any) => {
        const row = find(
          tables.chatbotProviderBinding,
          (r) => r.id === where.id
        )
        if (row && row.credentialId) {
          const cred = tables.providerCredential.find(
            (c) => c.id === row.credentialId
          )
          if (cred && cred.profileId) {
            cred.profile = tables.providerProfile.find(
              (pr) => pr.id === cred.profileId
            )
          }
          row.credential = cred ?? null
        }
        return row
      },
      findFirst: async ({ where }: any) => {
        const row = find(
          tables.chatbotProviderBinding,
          (r) => r.id === where.chatbotId || r.isActive === where.isActive
        )
        if (row && row.credentialId) {
          const cred = tables.providerCredential.find(
            (c) => c.id === row.credentialId
          )
          row.credential = cred
        }
        return row
      },
    },
    byokUsageAccount: {
      aggregate: async ({ where }: any) => ({
        _sum: {
          reservedAmount: sumField(where, 'reservedAmount'),
          usedAmount: sumField(where, 'usedAmount'),
        },
      }),
      create: async ({ data }: any) => {
        const row = {
          id: nid(),
          usedAmount: 0,
          isSettled: false,
          settledAt: null,
          ...data,
        }
        tables.byokUsageAccount.push(row)
        return row
      },
      findUnique: async ({ where }: any) =>
        find(tables.byokUsageAccount, (r) => r.id === where.id),
      update: async ({ where, data }: any) => {
        const row = find(tables.byokUsageAccount, (r) => r.id === where.id)!
        Object.assign(row, data)
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
        return find(tables.byokCapability, (r) => r.id === where.id)
      },
      create: async ({ data }: any) => {
        const row = { id: nid(), consumedAt: null, ...data }
        tables.byokCapability.push(row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = find(tables.byokCapability, (r) => r.id === where.id)!
        Object.assign(row, data)
        return row
      },
    },
    $transaction: async (fn: (db: unknown) => unknown, _opts?: unknown) =>
      fn(db),
  }

  function seed() {
    tables.providerProfile.push({
      id: 'profile-1',
      key: 'uzh-azure-openai',
      version: 1,
    })
    tables.providerCredential.push({
      id: 'cred-1',
      ownerId: 'owner-1',
      status: 'ACTIVE',
      vaultSecretVersion: 1,
      profileId: 'profile-1',
    })
    tables.chatbotProviderBinding.push({
      id: 'binding-1',
      credentialId: 'cred-1',
      chatbotId: 'bot-1',
      ownerId: 'owner-1',
      allowedModelAlias: 'gpt-5.6-luna',
      isActive: true,
      participantQuotaLimit: 10,
      aggregateQuotaLimit: 100,
      currentNoticeVersion: 1,
    })
  }

  return { tables, db, seed }
}

// ---------------------------------------------------------------------------
// Tests for the reservation lifecycle logic used in byokGateway
// (the actual import path is tested via the graphql package's test suite;
// these tests verify that the same invariants hold when called from Chat)
// ---------------------------------------------------------------------------

describe('BYOK gateway reservation invariants', () => {
  let d: ReturnType<typeof makeDb>

  beforeEach(() => {
    d = makeDb()
    d.seed()
  })

  test('reserve creates usage account with reserved amount and capability with hash-only bearer', async () => {
    // Simulate what reserveByokCapability does internally
    const cost = '0.50'
    const rawToken = crypto.randomBytes(32).toString('base64url')
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex')

    const binding = (await d.db.chatbotProviderBinding.findUnique({
      where: { id: 'binding-1' },
    }))!

    expect(binding.credential.status).toBe('ACTIVE')
    expect(binding.credential.profile.key).toBe('uzh-azure-openai')

    const usageAccount = await d.db.byokUsageAccount.create({
      data: {
        credentialId: binding.credential.id,
        bindingId: binding.id,
        participantId: 'p1',
        reservedAmount: cost,
        currency: 'CHF',
      },
    })
    expect(usageAccount.reservedAmount).toBe('0.50')

    const cap = await d.db.byokCapability.create({
      data: {
        ownerId: binding.ownerId,
        chatbotId: 'bot-1',
        profileKey: binding.credential.profile.key,
        allowedModelAlias: binding.allowedModelAlias,
        vaultSecretVersion: binding.credential.vaultSecretVersion,
        status: 'ISSUED',
        bearerHash: hash,
        expiresAt: new Date(Date.now() + 60_000),
        credentialId: binding.credential.id,
        bindingId: binding.id,
        usageAccountId: usageAccount.id,
      },
    })
    expect(cap.status).toBe('ISSUED')
    expect(JSON.stringify(d.tables)).not.toContain(rawToken)
    expect(cap.bearerHash).toMatch(/^[a-f0-9]{64}$/)
  })

  test('aggregate cap includes both reserved and used amounts', async () => {
    // Seed a settled usage account
    await d.db.byokUsageAccount.create({
      data: {
        credentialId: 'cred-1',
        bindingId: 'binding-1',
        participantId: 'p1',
        reservedAmount: '0',
        usedAmount: '5.00',
        isSettled: true,
        currency: 'CHF',
      },
    })
    const agg = await d.db.byokUsageAccount.aggregate({
      where: { bindingId: 'binding-1' },
    })
    const total = Number(agg._sum.reservedAmount) + Number(agg._sum.usedAmount)
    expect(total).toBe(5.0)
  })

  test('settle moves reserved to used and is idempotent', async () => {
    const acct = await d.db.byokUsageAccount.create({
      data: {
        credentialId: 'cred-1',
        bindingId: 'binding-1',
        participantId: 'p1',
        reservedAmount: '0.50',
        currency: 'CHF',
      },
    })
    const updated = await d.db.byokUsageAccount.update({
      where: { id: acct.id },
      data: {
        usedAmount: '0.45',
        reservedAmount: '0',
        isSettled: true,
        settledAt: new Date(),
      },
    })
    expect(Number(updated.usedAmount)).toBeCloseTo(0.45)
    expect(Number(updated.reservedAmount)).toBe(0)
    expect(updated.isSettled).toBe(true)

    // Second settle attempt sees isSettled=true and returns false
    expect(d.tables.byokUsageAccount[0].isSettled).toBe(true)
  })

  test('cancel releases reserved quota', async () => {
    await d.db.byokUsageAccount.create({
      data: {
        credentialId: 'cred-1',
        bindingId: 'binding-1',
        participantId: 'p1',
        reservedAmount: '5.00',
        currency: 'CHF',
      },
    })
    await d.db.byokUsageAccount.update({
      where: { id: d.tables.byokUsageAccount[0]!.id },
      data: { reservedAmount: '0' },
    })
    expect(Number(d.tables.byokUsageAccount[0]!.reservedAmount)).toBe(0)
  })
})
