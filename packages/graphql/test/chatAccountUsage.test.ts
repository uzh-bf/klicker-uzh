import { randomUUID } from 'node:crypto'
import { getEffectiveChatAccountUsage } from '@klicker-uzh/prisma'
import {
  type ChatAccountUsage,
  type Prisma,
  type PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { getZurichMonthReset, getZurichMonthStart } from '@klicker-uzh/util'
import { createYoga } from 'graphql-yoga'
import type { ContextWithUser } from '@/lib/context.js'
import {
  getChatAccountUsage,
  setChatAccountUsageBudgets,
} from '@/services/chatAccountUsage.js'
import { schema } from '../src/index.js'
import { initializePrisma } from './helpers.js'
import { userOne, userTwo } from './userData.js'

const NOW = new Date('2026-08-15T10:00:00Z')
const NEXT_MONTH = new Date('2026-09-15T10:00:00Z')

describe('ChatAccountUsage service and GraphQL API', () => {
  let prisma: PrismaClient
  let ownerId: string
  let otherOwnerId: string
  let adminId: string
  let ownerCtx: ContextWithUser
  let adminCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
  })

  beforeEach(async () => {
    ownerId = randomUUID()
    otherOwnerId = randomUUID()
    adminId = randomUUID()

    await prisma.user.createMany({
      data: [
        syntheticUser(ownerId, 'owner', true),
        syntheticUser(otherOwnerId, 'other', true),
        syntheticUser(adminId, 'admin', false, UserRole.ADMIN),
      ],
    })

    ownerCtx = contextFor(ownerId, UserRole.USER, UserLoginScope.ACCOUNT_OWNER)
    adminCtx = contextFor(adminId, UserRole.ADMIN, UserLoginScope.FULL_ACCESS)
  })

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, otherOwnerId, adminId] } },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function syntheticUser(
    id: string,
    label: string,
    authorized: boolean,
    role: UserRole = UserRole.USER
  ) {
    return {
      id,
      email: `${label}-${id}@invalid.example`,
      shortname: `${label}-${id}`,
      role,
      aiChatbotPublishingEnabled: authorized,
    }
  }

  function contextFor(
    sub: string,
    role: UserRole,
    scope: UserLoginScope
  ): ContextWithUser {
    return {
      prisma,
      user: {
        sub,
        role,
        scope,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as ContextWithUser
  }

  async function seedUsage({
    usageClass,
    budgetCredits,
    usedCredits,
    now = NOW,
    targetOwnerId = ownerId,
  }: {
    usageClass: 'BASE' | 'ADVANCED'
    budgetCredits: number
    usedCredits: number
    now?: Date
    targetOwnerId?: string
  }) {
    return prisma.chatAccountUsage.create({
      data: {
        ownerId: targetOwnerId,
        usageClass,
        monthStart: getZurichMonthStart(now),
        budgetCredits,
        usedCredits,
      },
    })
  }

  async function executeGraphql({
    source,
    context = ownerCtx,
    variables,
  }: {
    source: string
    context?: ContextWithUser
    variables?: Record<string, unknown>
  }) {
    const yoga = createYoga({
      schema,
      context: () => context,
      graphqlEndpoint: '/graphql',
    })
    const response = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: source, variables }),
    })
    return (await response.json()) as {
      data?: Record<string, unknown>
      errors?: { message: string; extensions?: { code?: string } }[]
    }
  }

  function prismaWithTransactionClient(
    transform: (
      transactionClient: Prisma.TransactionClient
    ) => Prisma.TransactionClient
  ): PrismaClient {
    return new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === '$transaction') {
          return (
            callback: (
              transactionClient: Prisma.TransactionClient
            ) => Promise<unknown>
          ) =>
            target.$transaction((transactionClient) =>
              callback(transform(transactionClient))
            )
        }

        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }

  function interceptUsageUpserts(
    transactionClient: Prisma.TransactionClient,
    upsert: (
      args: Prisma.ChatAccountUsageUpsertArgs,
      call: number,
      proceed: (
        args: Prisma.ChatAccountUsageUpsertArgs
      ) => Promise<ChatAccountUsage>
    ) => Promise<ChatAccountUsage>
  ): Prisma.TransactionClient {
    let call = 0
    const delegate = transactionClient.chatAccountUsage
    const usageDelegate = new Proxy(delegate, {
      get(target, property, receiver) {
        if (property === 'upsert') {
          return (args: Prisma.ChatAccountUsageUpsertArgs) => {
            call += 1
            return upsert(args, call, (upsertArgs) => target.upsert(upsertArgs))
          }
        }

        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })

    return new Proxy(transactionClient, {
      get(target, property, receiver) {
        if (property === 'chatAccountUsage') return usageDelegate
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as Prisma.TransactionClient
  }

  it('enforces one row per owner, class, and Zurich month', async () => {
    await seedUsage({
      usageClass: 'ADVANCED',
      budgetCredits: 0,
      usedCredits: 0,
    })

    await expect(
      seedUsage({ usageClass: 'ADVANCED', budgetCredits: 0, usedCredits: 0 })
    ).rejects.toThrow()

    await expect(
      prisma.chatAccountUsage.count({ where: { ownerId } })
    ).resolves.toBe(1)
  })

  it('projects fixed zero lanes for missing rows and exact live values', async () => {
    await expect(getChatAccountUsage({ now: NOW }, ownerCtx)).resolves.toEqual({
      authorized: true,
      baseModelUsage: {
        usageClass: 'BASE',
        budgetCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        resetAt: getZurichMonthReset(NOW),
      },
      advancedModelUsage: {
        usageClass: 'ADVANCED',
        budgetCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        resetAt: getZurichMonthReset(NOW),
      },
    })

    await Promise.all([
      seedUsage({ usageClass: 'BASE', budgetCredits: 10, usedCredits: 4.5 }),
      seedUsage({ usageClass: 'ADVANCED', budgetCredits: 1, usedCredits: 2 }),
    ])
    const overview = await getChatAccountUsage({ now: NOW }, ownerCtx)
    expect(overview).toMatchObject({
      authorized: true,
      baseModelUsage: {
        usageClass: 'BASE',
        budgetCredits: 10,
        usedCredits: 4.5,
        remainingCredits: 5.5,
      },
      advancedModelUsage: {
        usageClass: 'ADVANCED',
        budgetCredits: 1,
        usedCredits: 2,
        remainingCredits: 0,
      },
    })
  })

  it('carries both prior-month budgets with reset usage', async () => {
    await Promise.all([
      seedUsage({ usageClass: 'BASE', budgetCredits: 5, usedCredits: 2 }),
      seedUsage({ usageClass: 'ADVANCED', budgetCredits: 7, usedCredits: 4 }),
    ])

    const overview = await getChatAccountUsage({ now: NEXT_MONTH }, ownerCtx)

    expect(overview).toMatchObject({
      baseModelUsage: {
        usageClass: 'BASE',
        budgetCredits: 5,
        usedCredits: 0,
        remainingCredits: 5,
        resetAt: getZurichMonthReset(NEXT_MONTH),
      },
      advancedModelUsage: {
        usageClass: 'ADVANCED',
        budgetCredits: 7,
        usedCredits: 0,
        remainingCredits: 7,
        resetAt: getZurichMonthReset(NEXT_MONTH),
      },
    })
  })

  it('allows only account owners and admins without leaking target existence', async () => {
    await expect(
      getChatAccountUsage({ ownerId, now: NOW }, ownerCtx)
    ).resolves.toMatchObject({ authorized: true })
    await expect(
      getChatAccountUsage({ ownerId, now: NOW }, adminCtx)
    ).resolves.toMatchObject({ authorized: true })
    await expect(
      setChatAccountUsageBudgets(
        {
          ownerId: otherOwnerId,
          baseBudgetCredits: 3,
          advancedBudgetCredits: 4,
          now: NOW,
        },
        adminCtx
      )
    ).resolves.toMatchObject({
      baseModelUsage: { budgetCredits: 3 },
      advancedModelUsage: { budgetCredits: 4 },
    })

    for (const targetOwnerId of [otherOwnerId, randomUUID()]) {
      await expect(
        getChatAccountUsage({ ownerId: targetOwnerId, now: NOW }, ownerCtx)
      ).rejects.toMatchObject({
        message: 'FORBIDDEN',
        extensions: { code: 'FORBIDDEN' },
      })
      await expect(
        setChatAccountUsageBudgets(
          {
            ownerId: targetOwnerId,
            baseBudgetCredits: 1,
            advancedBudgetCredits: 1,
            now: NOW,
          },
          ownerCtx
        )
      ).rejects.toMatchObject({
        message: 'FORBIDDEN',
        extensions: { code: 'FORBIDDEN' },
      })
    }

    for (const scope of [
      UserLoginScope.FULL_ACCESS,
      UserLoginScope.SESSION_EXEC,
      UserLoginScope.READ_ONLY,
    ]) {
      await expect(
        getChatAccountUsage(
          { now: NOW },
          contextFor(ownerId, UserRole.USER, scope)
        )
      ).rejects.toThrow('FORBIDDEN')
    }

    for (const role of [UserRole.PARTICIPANT, UserRole.TEMPORARY_PARTICIPANT]) {
      await expect(
        getChatAccountUsage(
          { now: NOW },
          contextFor(ownerId, role, UserLoginScope.ACCOUNT_OWNER)
        )
      ).rejects.toThrow('FORBIDDEN')
    }

    await expect(
      getChatAccountUsage({ ownerId: randomUUID(), now: NOW }, adminCtx)
    ).resolves.toBeNull()
  })

  it('keeps disabled capability visible but rejects budget writes', async () => {
    await prisma.user.update({
      where: { id: ownerId },
      data: { aiChatbotPublishingEnabled: false },
    })
    await seedUsage({ usageClass: 'BASE', budgetCredits: 5, usedCredits: 1 })

    await expect(
      getChatAccountUsage({ now: NOW }, ownerCtx)
    ).resolves.toMatchObject({ authorized: false })
    await expect(
      setChatAccountUsageBudgets(
        { baseBudgetCredits: 10, advancedBudgetCredits: 20, now: NOW },
        ownerCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'CHAT_ACCOUNT_USAGE_DISABLED' },
    })
    const rows = await prisma.chatAccountUsage.findMany({ where: { ownerId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.budgetCredits.toString()).toBe('5')
  })

  it('creates both budgets atomically and preserves used credits on update', async () => {
    const created = await setChatAccountUsageBudgets(
      { baseBudgetCredits: 10.5, advancedBudgetCredits: 20.25, now: NOW },
      ownerCtx
    )
    expect(created).toMatchObject({
      baseModelUsage: { budgetCredits: 10.5, usedCredits: 0 },
      advancedModelUsage: { budgetCredits: 20.25, usedCredits: 0 },
    })

    await prisma.chatAccountUsage.updateMany({
      where: { ownerId },
      data: { usedCredits: 7 },
    })
    const updated = await setChatAccountUsageBudgets(
      { baseBudgetCredits: 5, advancedBudgetCredits: 6, now: NOW },
      ownerCtx
    )

    expect(updated).toMatchObject({
      baseModelUsage: {
        budgetCredits: 5,
        usedCredits: 7,
        remainingCredits: 0,
      },
      advancedModelUsage: {
        budgetCredits: 6,
        usedCredits: 7,
        remainingCredits: 0,
      },
    })
  })

  it('replaces carried budgets when a later month is configured', async () => {
    await Promise.all([
      seedUsage({ usageClass: 'BASE', budgetCredits: 5, usedCredits: 2 }),
      seedUsage({ usageClass: 'ADVANCED', budgetCredits: 7, usedCredits: 4 }),
    ])

    const updated = await setChatAccountUsageBudgets(
      {
        baseBudgetCredits: 11,
        advancedBudgetCredits: 13,
        now: NEXT_MONTH,
      },
      ownerCtx
    )

    expect(updated).toMatchObject({
      baseModelUsage: {
        budgetCredits: 11,
        usedCredits: 0,
        remainingCredits: 11,
      },
      advancedModelUsage: {
        budgetCredits: 13,
        usedCredits: 0,
        remainingCredits: 13,
      },
    })
    await expect(
      getChatAccountUsage({ now: NEXT_MONTH }, ownerCtx)
    ).resolves.toMatchObject({
      baseModelUsage: { budgetCredits: 11, usedCredits: 0 },
      advancedModelUsage: { budgetCredits: 13, usedCredits: 0 },
    })

    const previousRows = await prisma.chatAccountUsage.findMany({
      where: { ownerId, monthStart: getZurichMonthStart(NOW) },
    })
    expect(previousRows).toHaveLength(2)
    expect(
      previousRows
        .find((row) => row.usageClass === 'BASE')
        ?.budgetCredits.toNumber()
    ).toBe(5)
    expect(
      previousRows
        .find((row) => row.usageClass === 'BASE')
        ?.usedCredits.toNumber()
    ).toBe(2)
    expect(
      previousRows
        .find((row) => row.usageClass === 'ADVANCED')
        ?.budgetCredits.toNumber()
    ).toBe(7)
    expect(
      previousRows
        .find((row) => row.usageClass === 'ADVANCED')
        ?.usedCredits.toNumber()
    ).toBe(4)
  })

  it('rejects malformed budgets without a partial write', async () => {
    for (const invalid of [-1, 0.0000001, Number.POSITIVE_INFINITY, 1e12]) {
      await expect(
        setChatAccountUsageBudgets(
          {
            baseBudgetCredits: 2,
            advancedBudgetCredits: invalid,
            now: NOW,
          },
          ownerCtx
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
      await expect(
        prisma.chatAccountUsage.count({ where: { ownerId } })
      ).resolves.toBe(0)
    }
  })

  it('rolls back the first lane when the second upsert fails', async () => {
    const failingPrisma = prismaWithTransactionClient((transactionClient) =>
      interceptUsageUpserts(transactionClient, (args, call, proceed) => {
        if (call === 2) throw new Error('synthetic second upsert failure')
        return proceed(args)
      })
    )

    await expect(
      setChatAccountUsageBudgets(
        { baseBudgetCredits: 2, advancedBudgetCredits: 3, now: NOW },
        { ...ownerCtx, prisma: failingPrisma }
      )
    ).rejects.toThrow('synthetic second upsert failure')
    await expect(
      prisma.chatAccountUsage.count({ where: { ownerId } })
    ).resolves.toBe(0)
  })

  it('preserves concurrent U2-style used-credit increments', async () => {
    await Promise.all([
      seedUsage({ usageClass: 'BASE', budgetCredits: 1, usedCredits: 0 }),
      seedUsage({ usageClass: 'ADVANCED', budgetCredits: 1, usedCredits: 0 }),
    ])

    let releaseBudgetUpdate!: () => void
    const budgetUpdateReleased = new Promise<void>((resolve) => {
      releaseBudgetUpdate = resolve
    })
    let signalBaseUpsert!: () => void
    const baseUpserted = new Promise<void>((resolve) => {
      signalBaseUpsert = resolve
    })
    const gatedPrisma = prismaWithTransactionClient((transactionClient) =>
      interceptUsageUpserts(transactionClient, async (args, call, proceed) => {
        const result = await proceed(args)
        if (call === 1) {
          signalBaseUpsert()
          await budgetUpdateReleased
        }
        return result
      })
    )

    const budgetUpdate = setChatAccountUsageBudgets(
      { baseBudgetCredits: 9, advancedBudgetCredits: 8, now: NOW },
      { ...ownerCtx, prisma: gatedPrisma }
    )
    await baseUpserted
    const charges = Array.from({ length: 8 }, () =>
      prisma.chatAccountUsage.update({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId,
            usageClass: 'BASE',
            monthStart: getZurichMonthStart(NOW),
          },
        },
        data: { usedCredits: { increment: 0.125 } },
      })
    )
    releaseBudgetUpdate()
    await Promise.all([budgetUpdate, ...charges])

    const rows = await prisma.chatAccountUsage.findMany({
      where: { ownerId },
      orderBy: { usageClass: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(
      rows.find((row) => row.usageClass === 'BASE')?.usedCredits.toString()
    ).toBe('1')
    expect(
      rows.find((row) => row.usageClass === 'BASE')?.budgetCredits.toString()
    ).toBe('9')
    expect(
      rows
        .find((row) => row.usageClass === 'ADVANCED')
        ?.budgetCredits.toString()
    ).toBe('8')
  })

  it('executes owner query and mutation through the schema', async () => {
    const mutation = await executeGraphql({
      source: `
        mutation SetBudgets($base: Float!, $advanced: Float!) {
          setChatAccountUsageBudgets(
            baseBudgetCredits: $base
            advancedBudgetCredits: $advanced
          ) {
            authorized
            baseModelUsage { usageClass budgetCredits usedCredits remainingCredits resetAt }
            advancedModelUsage { usageClass budgetCredits usedCredits remainingCredits resetAt }
          }
        }
      `,
      variables: { base: 4.5, advanced: 6.25 },
    })
    expect(mutation.errors).toBeUndefined()
    expect(mutation.data).toMatchObject({
      setChatAccountUsageBudgets: {
        authorized: true,
        baseModelUsage: { usageClass: 'BASE', budgetCredits: 4.5 },
        advancedModelUsage: { usageClass: 'ADVANCED', budgetCredits: 6.25 },
      },
    })

    const query = await executeGraphql({
      source: `
        query {
          getChatAccountUsage {
            authorized
            baseModelUsage { usageClass budgetCredits usedCredits remainingCredits resetAt }
            advancedModelUsage { usageClass budgetCredits usedCredits remainingCredits resetAt }
          }
        }
      `,
    })
    expect(query.errors).toBeUndefined()
    expect(query.data?.getChatAccountUsage).toEqual(
      mutation.data?.setChatAccountUsageBudgets
    )
  })

  it('rejects participant callers at the GraphQL schema boundary', async () => {
    const result = await executeGraphql({
      source: 'query { getChatAccountUsage { authorized } }',
      context: contextFor(
        ownerId,
        UserRole.PARTICIPANT,
        UserLoginScope.ACCOUNT_OWNER
      ),
    })

    expect(result.data).toEqual({ getChatAccountUsage: null })
    expect(result.errors?.[0]?.message).toBe('Unauthorized')
  })
})

describe('ChatAccountUsage effective usage helper', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
  })

  beforeEach(async () => {
    await prisma.user.createMany({
      data: [userOne, userTwo].map(({ id, email, shortname }) => ({
        id,
        email,
        shortname,
      })),
    })
  })

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userOne.id, userTwo.id] } },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('uses an explicit current-month budget instead of carried history', async () => {
    const previousMonth = getZurichMonthStart(new Date('2026-07-15T10:00:00Z'))
    const currentMonth = getZurichMonthStart(new Date('2026-08-15T10:00:00Z'))

    await prisma.chatAccountUsage.createMany({
      data: [
        {
          ownerId: userOne.id,
          usageClass: 'ADVANCED',
          monthStart: previousMonth,
          budgetCredits: 50,
          usedCredits: 20,
        },
        {
          ownerId: userOne.id,
          usageClass: 'ADVANCED',
          monthStart: currentMonth,
          budgetCredits: 0,
          usedCredits: 5,
        },
      ],
    })

    const usage = await getEffectiveChatAccountUsage(prisma, {
      ownerId: userOne.id,
      usageClass: 'ADVANCED',
      monthStart: currentMonth,
    })

    expect(usage?.monthStart).toEqual(currentMonth)
    expect(usage?.budgetCredits.toNumber()).toBe(0)
    expect(usage?.usedCredits.toNumber()).toBe(5)
  })

  it('carries the latest prior budget and resets used credits', async () => {
    const oldestMonth = getZurichMonthStart(new Date('2026-06-15T10:00:00Z'))
    const previousMonth = getZurichMonthStart(new Date('2026-07-15T10:00:00Z'))
    const currentMonth = getZurichMonthStart(new Date('2026-08-15T10:00:00Z'))

    await prisma.chatAccountUsage.createMany({
      data: [
        {
          ownerId: userOne.id,
          usageClass: 'BASE',
          monthStart: oldestMonth,
          budgetCredits: 25,
          usedCredits: 10,
        },
        {
          ownerId: userOne.id,
          usageClass: 'BASE',
          monthStart: previousMonth,
          budgetCredits: 40,
          usedCredits: 30,
        },
      ],
    })

    const usage = await getEffectiveChatAccountUsage(prisma, {
      ownerId: userOne.id,
      usageClass: 'BASE',
      monthStart: currentMonth,
    })

    expect(usage?.monthStart).toEqual(currentMonth)
    expect(usage?.budgetCredits.toNumber()).toBe(40)
    expect(usage?.usedCredits.toNumber()).toBe(0)
  })

  it('excludes future, other-class, and other-owner rows', async () => {
    const currentMonth = getZurichMonthStart(new Date('2026-08-15T10:00:00Z'))
    const futureMonth = getZurichMonthStart(new Date('2026-09-15T10:00:00Z'))

    await prisma.chatAccountUsage.createMany({
      data: [
        {
          ownerId: userOne.id,
          usageClass: 'BASE',
          monthStart: futureMonth,
          budgetCredits: 50,
        },
        {
          ownerId: userOne.id,
          usageClass: 'ADVANCED',
          monthStart: currentMonth,
          budgetCredits: 50,
        },
        {
          ownerId: userTwo.id,
          usageClass: 'BASE',
          monthStart: currentMonth,
          budgetCredits: 50,
        },
      ],
    })

    const usage = await getEffectiveChatAccountUsage(prisma, {
      ownerId: userOne.id,
      usageClass: 'BASE',
      monthStart: currentMonth,
    })

    expect(usage).toBeNull()
  })
})
