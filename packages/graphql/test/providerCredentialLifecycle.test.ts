import { describe, expect, test } from 'vitest'

import {
  FakeGatewayAdapter,
  createBinding,
  registerCredential,
  revokeCredential,
  rotateCredential,
  suspendCredential,
  validateCredential,
} from '../src/services/providerCredentials.js'
import type { ContextWithUser } from '../src/lib/context.js'

// ---------------------------------------------------------------------------
// Minimal fake Prisma covering exactly the calls the lifecycle service makes.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

function makeFakeDb() {
  const tables: {
    providerProfile: Row[]
    providerCredential: Row[]
    providerCredentialOutbox: Row[]
    chatbotProviderBinding: Row[]
    chatbot: Row[]
  } = {
    providerProfile: [],
    providerCredential: [],
    providerCredentialOutbox: [],
    chatbotProviderBinding: [],
    chatbot: [],
  }
  let idCounter = 0
  const nextId = () => {
    idCounter++
    const n = idCounter.toString().padStart(12, '0')
    return `00000000-0000-4000-8000-${n}`
  }

  const find = <T extends Row>(rows: T[], pred: (r: T) => boolean) =>
    rows.find(pred) ?? null

  const db = {
    providerProfile: {
      findUnique: async ({ where }: any) =>
        find(tables.providerProfile, (r) => r.key === where.key),
      create: async ({ data }: any) => {
        const row = {
          id: nextId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }
        tables.providerProfile.push(row)
        return row
      },
      update: async ({ where, data }: any) => {
        const row = tables.providerProfile.find((r) => r.id === where.id)!
        Object.assign(row, data)
        return row
      },
    },
    providerCredential: {
      findFirst: async ({ where, include }: any) => {
        const row = find(tables.providerCredential, (r) => {
          if (where.id && r.id !== where.id) return false
          if (where.ownerId && r.ownerId !== where.ownerId) return false
          if (where.status?.in && !where.status.in.includes(r.status))
            return false
          if (typeof where.status === 'string' && r.status !== where.status)
            return false
          return true
        })
        if (row && include?.profile)
          row.profile = tables.providerProfile.find(
            (p) => p.id === row.profileId
          )!
        return row
      },
      create: async ({ data }: any) => {
        const row = {
          id: nextId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          validatedAt: null,
          validatedModelAlias: null,
          safeFingerprint: null,
          ...data,
        }
        tables.providerCredential.push(row)
        return row
      },
      update: async ({ where, data, include }: any) => {
        const row = tables.providerCredential.find((r) => r.id === where.id)!
        Object.assign(row, data)
        if (include?.profile)
          row.profile = tables.providerProfile.find(
            (p) => p.id === row.profileId
          )!
        return row
      },
    },
    providerCredentialOutbox: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const row = {
          id: nextId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          attempts: 0,
          processedAt: null,
          ...data,
        }
        tables.providerCredentialOutbox.push(row)
        return row
      },
    },
    chatbot: {
      findFirst: async ({ where }: any) =>
        find(
          tables.chatbot,
          (r) => r.id === where.id && r.ownerId === where.ownerId
        ),
    },
    chatbotProviderBinding: {
      findFirst: async ({ where }: any) =>
        find(
          tables.chatbotProviderBinding,
          (r) => r.id === where.id && r.ownerId === where.ownerId
        ),
      create: async ({ data }: any) => {
        const row = {
          id: nextId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: false,
          ...data,
        }
        tables.chatbotProviderBinding.push(row)
        return row
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0
        for (const r of tables.chatbotProviderBinding) {
          if (
            r.credentialId === where.credentialId &&
            r.isActive === where.isActive
          ) {
            Object.assign(r, data)
            count++
          }
        }
        return { count }
      },
    },
  }
  return { db, tables }
}

function seedChatbot(fake: ReturnType<typeof makeFakeDb>, ownerId: string) {
  const row = {
    id: '00000000-0000-4000-8000-999999999999',
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  fake.tables.chatbot.push(row)
  return row
}

function makeCtx(
  db: ReturnType<typeof makeFakeDb>['db'],
  userId: string
): ContextWithUser {
  return {
    user: {
      sub: userId,
      role: 'USER',
      scope: 'EDU_ID',
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: db,
  } as unknown as ContextWithUser
}

describe('provider credential lifecycle (K2)', () => {
  test('registration stores no secret material and records an outbox event', async () => {
    const { db, tables } = makeFakeDb()
    const ctx = makeCtx(db, 'user-1')
    const result = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ctx
    )

    expect(result.status).toBe('PENDING_VALIDATION')
    expect(result.safeFingerprint).toMatch(/^fp_/)
    // The secret value never appears anywhere in product state or projections.
    const serializedState = JSON.stringify(tables)
    expect(serializedState).not.toContain('test-secret-value-1')
    expect(serializedState).not.toContain('secretValue')
    // One durable outbox event exists.
    expect(tables.providerCredentialOutbox).toHaveLength(1)
    expect(tables.providerCredentialOutbox[0]!.eventType).toBe(
      'CREDENTIAL_REGISTERED'
    )
  })

  test('cross-owner access returns null (IDOR denial)', async () => {
    const { db } = makeFakeDb()
    const ownerCtx = makeCtx(db, 'user-1')
    const attackerCtx = makeCtx(db, 'user-2')

    const credential = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ownerCtx
    )
    await validateCredential(credential.id, ownerCtx)

    expect(await validateCredential(credential.id, attackerCtx)).toBeNull()
    expect(await suspendCredential(credential.id, attackerCtx)).toBeNull()
    expect(await revokeCredential(credential.id, attackerCtx)).toBeNull()
  })

  test('rotation stages at gateway first; failed stage leaves active version intact', async () => {
    const { db, tables } = makeFakeDb()
    const ctx = makeCtx(db, 'user-1')
    const credential = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ctx
    )
    await validateCredential(credential.id, ctx)

    const failingAdapter = {
      storeSecret: FakeGatewayAdapter.storeSecret,
      stageRotation: async () => {
        throw new Error('gateway unavailable')
      },
      revokeSecret: FakeGatewayAdapter.revokeSecret,
    }

    await expect(
      rotateCredential(
        { credentialId: credential.id, secret: 'rotated-secret-val' },
        ctx,
        failingAdapter
      )
    ).rejects.toThrow('gateway unavailable')

    const row = tables.providerCredential.find((r) => r.id === credential.id)!
    expect(row.vaultSecretVersion).toBe(credential.vaultSecretVersion) // unchanged after failure
  })

  test('successful rotation switches version only after staging succeeds', async () => {
    const { db, tables } = makeFakeDb()
    const ctx = makeCtx(db, 'user-1')
    const credential = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ctx
    )
    await validateCredential(credential.id, ctx)

    const rotated = await rotateCredential(
      { credentialId: credential.id, secret: 'rotated-secret-val' },
      ctx
    )

    expect(rotated!.vaultSecretVersion).toBe(credential.vaultSecretVersion + 1)
    const outboxEvents = tables.providerCredentialOutbox.map((r) => r.eventType)
    expect(outboxEvents).toContain('CREDENTIAL_ROTATED')
  })

  test('suspend synchronously deactivates all bindings', async () => {
    const { db, tables } = makeFakeDb()
    const ctx = makeCtx(db, 'user-1')
    const credential = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ctx
    )
    await validateCredential(credential.id, ctx)

    const chatbot = seedChatbot({ db, tables }, ctx.user.sub)
    await createBinding(
      {
        credentialId: credential.id,
        chatbotId: chatbot.id,
        allowedModelAlias: 'gpt-5.6-luna',
        participantQuotaLimit: 10,
        aggregateQuotaLimit: 100,
      },
      ctx
    )
    const binding = tables.chatbotProviderBinding[0]!
    binding.isActive = true // simulate activation

    const suspended = await suspendCredential(credential.id, ctx)
    expect(suspended!.status).toBe('SUSPENDED')
    expect(binding.isActive).toBe(false)
  })

  test('revoke blocks further use and deactivates bindings synchronously', async () => {
    const { db } = makeFakeDb()
    const ctx = makeCtx(db, 'user-1')
    const credential = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ctx
    )
    await validateCredential(credential.id, ctx)

    const revoked = await revokeCredential(credential.id, ctx)
    expect(revoked!.status).toBe('REVOKED')

    // A revoked credential cannot be found for further lifecycle actions by the same owner.
    expect(await suspendCredential(credential.id, ctx)).toBeNull()
    expect(
      await rotateCredential(
        { credentialId: credential.id, secret: 'another-secret-val' },
        ctx
      )
    ).toBeNull()
  })

  test('binding rejects model aliases outside the approved profile manifest', async () => {
    const { db, tables } = makeFakeDb()
    const ctx = makeCtx(db, 'user-1')
    const credential = await registerCredential(
      { profileKey: 'uzh-azure-openai', secret: 'test-secret-value-1' },
      ctx
    )
    await validateCredential(credential.id, ctx)
    const chatbot = seedChatbot({ db, tables }, ctx.user.sub)

    await expect(
      createBinding(
        {
          credentialId: credential.id,
          chatbotId: chatbot.id,
          allowedModelAlias: 'not-an-approved-model',
          participantQuotaLimit: 10,
          aggregateQuotaLimit: 100,
        },
        ctx
      )
    ).rejects.toThrow(/not approved/)
  })
})
