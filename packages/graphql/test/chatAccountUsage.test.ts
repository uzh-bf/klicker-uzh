import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { getEffectiveChatAccountUsage } from '@klicker-uzh/prisma'
import { getZurichMonthStart } from '@klicker-uzh/util'
import { beforeEach, describe, expect, it } from 'vitest'
import { initializePrisma } from './helpers.js'
import { userOne, userTwo } from './userData.js'

describe('ChatAccountUsage account/class/month uniqueness', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    const { prisma: newPrisma } = await initializePrisma()
    prisma = newPrisma
  })

  afterAll(async () => {
    await prisma.$disconnect()
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

  it('allows one row per owner/class/month and rejects the duplicate', async () => {
    const monthStart = getZurichMonthStart(new Date('2026-08-15T10:00:00Z'))

    const created = await prisma.chatAccountUsage.create({
      data: {
        ownerId: userOne.id,
        usageClass: 'ADVANCED',
        monthStart,
      },
    })

    expect(created.budgetCredits.toNumber()).toBe(0)
    expect(created.usedCredits.toNumber()).toBe(0)

    await expect(
      prisma.chatAccountUsage.create({
        data: {
          ownerId: userOne.id,
          usageClass: 'ADVANCED',
          monthStart,
        },
      })
    ).rejects.toThrow()

    const count = await prisma.chatAccountUsage.count({
      where: {
        ownerId: userOne.id,
        usageClass: 'ADVANCED',
        monthStart,
      },
    })
    expect(count).toBe(1)
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
