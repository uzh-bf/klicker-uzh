import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { getZurichMonthStart } from '@klicker-uzh/util'
import { beforeEach, describe, expect, it } from 'vitest'
import { initializePrisma } from './helpers.js'
import { userOne } from './userData.js'

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
    await prisma.user.create({
      data: {
        id: userOne.id,
        email: userOne.email,
        shortname: userOne.shortname,
      },
    })
  })

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userOne.id } }).catch(() => {})
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
})
