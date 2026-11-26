import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  DEFAULT_BASE_CHAT_BUDGET_CREDITS,
  getZurichMonthStart,
} from '@klicker-uzh/util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { backfillChatBaseBudget } from './2026-09-14_backfill_chat_base_budget.js'

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL

const isDisposableDatabase = (databaseUrl: string | undefined) => {
  if (!databaseUrl) return false

  try {
    const url = new URL(databaseUrl)
    return (
      decodeURIComponent(url.username) === 'klicker_test' &&
      decodeURIComponent(url.pathname) === '/klicker_test'
    )
  } catch {
    return false
  }
}

const testDescribe = isDisposableDatabase(DATABASE_URL)
  ? describe
  : describe.skip

const NOW = new Date('2026-09-14T09:00:00.000Z')
const CURRENT_MONTH = getZurichMonthStart(NOW)
const PREVIOUS_MONTH = new Date(
  Date.UTC(CURRENT_MONTH.getUTCFullYear(), CURRENT_MONTH.getUTCMonth() - 1, 1)
)

testDescribe('backfill chat base budget', () => {
  let prisma: PrismaClient
  const suffix = randomUUID()
  const unconfiguredOwner = {
    id: '',
    shortname: `backfill-unconfigured-${suffix}`,
  }
  const unentitledOwner = { id: '', shortname: `backfill-unentitled-${suffix}` }
  const configuredOwner = { id: '', shortname: `backfill-configured-${suffix}` }

  beforeAll(async () => {
    prisma = await createDisposableTestPrismaClient(DATABASE_URL!)

    const [unconfigured, unentitled, configured] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${unconfiguredOwner.shortname}@synthetic.invalid`,
          shortname: unconfiguredOwner.shortname,
          aiFeaturesEnabled: true,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${unentitledOwner.shortname}@synthetic.invalid`,
          shortname: unentitledOwner.shortname,
          aiFeaturesEnabled: false,
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `${configuredOwner.shortname}@synthetic.invalid`,
          shortname: configuredOwner.shortname,
          aiFeaturesEnabled: true,
        },
        select: { id: true },
      }),
    ])

    unconfiguredOwner.id = unconfigured.id
    unentitledOwner.id = unentitled.id
    configuredOwner.id = configured.id

    // A budget an administrator configured in an earlier month. It stays
    // effective through carry-forward, so the backfill must not touch it or
    // replace it with the default in the current month.
    await prisma.chatAccountUsage.create({
      data: {
        ownerId: configuredOwner.id,
        usageClass: 'BASE',
        monthStart: PREVIOUS_MONTH,
        budgetCredits: 7,
        usedCredits: 2,
      },
    })
  })

  afterAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            unconfiguredOwner.id,
            unentitledOwner.id,
            configuredOwner.id,
          ].filter(Boolean),
        },
      },
    })
    await prisma.$disconnect()
  })

  const baseRows = (ownerId: string) =>
    prisma.chatAccountUsage.findMany({
      where: { ownerId, usageClass: 'BASE' },
      orderBy: { monthStart: 'asc' },
    })

  it('creates nothing without the apply flag', async () => {
    const summary = await backfillChatBaseBudget({
      client: prisma,
      now: NOW,
      apply: false,
    })

    expect(summary.missing).toBeGreaterThan(0)
    expect(summary.created).toBe(0)
    expect(await baseRows(unconfiguredOwner.id)).toEqual([])
  })

  it('grants the monthly default only to the entitled account without base history', async () => {
    const summary = await backfillChatBaseBudget({
      client: prisma,
      now: NOW,
      apply: true,
    })

    expect(summary.created).toBeGreaterThan(0)

    const granted = await baseRows(unconfiguredOwner.id)
    expect(granted).toHaveLength(1)
    expect(granted[0]!.monthStart).toEqual(CURRENT_MONTH)
    expect(granted[0]!.budgetCredits.toNumber()).toBe(
      DEFAULT_BASE_CHAT_BUDGET_CREDITS
    )
    expect(granted[0]!.usedCredits.toNumber()).toBe(0)

    expect(await baseRows(unentitledOwner.id)).toEqual([])
  })

  it('leaves a configured base budget and its used credits untouched', async () => {
    await backfillChatBaseBudget({ client: prisma, now: NOW, apply: true })

    const configured = await baseRows(configuredOwner.id)
    expect(configured).toHaveLength(1)
    expect(configured[0]!.monthStart).toEqual(PREVIOUS_MONTH)
    expect(configured[0]!.budgetCredits.toNumber()).toBe(7)
    expect(configured[0]!.usedCredits.toNumber()).toBe(2)
  })

  it('is idempotent: a second run finds every entitled account configured', async () => {
    const first = await backfillChatBaseBudget({
      client: prisma,
      now: NOW,
      apply: true,
    })
    const grantedAfterFirstRun = await baseRows(unconfiguredOwner.id)

    const second = await backfillChatBaseBudget({
      client: prisma,
      now: NOW,
      apply: true,
    })

    expect(first.created).toBe(0)
    expect(second.created).toBe(0)
    expect(await baseRows(unconfiguredOwner.id)).toEqual(grantedAfterFirstRun)
  })

  it('never writes a past month', async () => {
    const rows = await prisma.chatAccountUsage.findMany({
      where: {
        ownerId: unconfiguredOwner.id,
        monthStart: { lt: CURRENT_MONTH },
      },
      select: { ownerId: true },
    })

    expect(rows).toEqual([])
  })
})
