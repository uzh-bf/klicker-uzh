import { randomUUID } from 'node:crypto'
import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  ElementGenerationBuildStatus,
  ElementType,
} from '@klicker-uzh/prisma/client'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  acquireElementGenerationLease,
  releaseElementGenerationLease,
} from '../src/services/elementGenerationLease.js'

const NOW = new Date('2026-09-04T12:00:00.000Z')
const LEASE_DURATION_MILLISECONDS = 15_000
const prisma = prismaClient

let ownerId: string
let graphBuildId: string

function createBarrier(participantCount: number) {
  let arrived = 0
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })

  return async () => {
    arrived += 1
    if (arrived === participantCount) release()
    await ready
  }
}

async function createBuild({
  status = ElementGenerationBuildStatus.PREPARING_INPUT,
  syncLeaseOwner = null,
  syncLeaseUntil = null,
}: {
  status?: ElementGenerationBuildStatus
  syncLeaseOwner?: string | null
  syncLeaseUntil?: Date | null
} = {}) {
  return prisma.elementGenerationBuild.create({
    data: {
      id: randomUUID(),
      ownerId,
      sourceGraphBuildId: graphBuildId,
      elementType: ElementType.SC,
      idempotencyKey: randomUUID(),
      configurationHash: 'lease-test-configuration',
      configuration: {
        itemType: 'SC',
        language: 'en',
        questionCount: 1,
        objectives: [],
        sourceScopes: [],
        bloomLevels: ['remember'],
        difficultyPreset: 'D1',
        difficultyCounts: { d1: 1, d2: 0, d3: 0, d4: 0, d5: 0 },
      },
      requestedElementCount: 1,
      status,
      syncLeaseOwner,
      syncLeaseUntil,
    },
  })
}

describe('element-generation lease', () => {
  beforeEach(async () => {
    ownerId = randomUUID()
    const kbId = randomUUID()
    graphBuildId = randomUUID()

    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `element-lease-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Element generation lease test KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `klickeruzh:kb:${kbId}:${graphBuildId}`,
      },
    })
  })

  afterEach(async () => {
    await prisma.user.delete({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('serializes simultaneous claims across two active database transactions', async () => {
    const build = await createBuild()
    const waitForBothTransactions = createBarrier(2)
    const backendPids: number[] = []

    const claims = await Promise.all(
      [0, 1].map(() =>
        prisma.$transaction(async (transaction) => {
          const rows = await transaction.$queryRaw<Array<{ pid: number }>>`
            SELECT pg_backend_pid() AS pid
          `
          backendPids.push(Number(rows[0]!.pid))
          await waitForBothTransactions()

          return acquireElementGenerationLease(transaction, {
            buildId: build.id,
            ownerId,
            now: NOW,
          })
        })
      )
    )

    expect(backendPids).toHaveLength(2)
    expect(new Set(backendPids).size).toBe(2)
    const winners = claims.filter((claim): claim is string => claim !== null)
    expect(winners).toHaveLength(1)

    await expect(
      prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: build.id },
        select: { syncLeaseOwner: true, syncLeaseUntil: true },
      })
    ).resolves.toEqual({
      syncLeaseOwner: winners[0],
      syncLeaseUntil: new Date(NOW.getTime() + LEASE_DURATION_MILLISECONDS),
    })

    await expect(
      releaseElementGenerationLease(prisma, build.id, winners[0]!)
    ).resolves.toBe(true)
  })

  it('rejects a foreign owner and a mismatched required status', async () => {
    const build = await createBuild()

    await expect(
      acquireElementGenerationLease(prisma, {
        buildId: build.id,
        ownerId: randomUUID(),
        expectedStatus: ElementGenerationBuildStatus.PREPARING_INPUT,
        now: NOW,
      })
    ).resolves.toBeNull()
    await expect(
      acquireElementGenerationLease(prisma, {
        buildId: build.id,
        ownerId,
        expectedStatus: ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW,
        now: NOW,
      })
    ).resolves.toBeNull()

    await expect(
      prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: build.id },
        select: { status: true, syncLeaseOwner: true, syncLeaseUntil: true },
      })
    ).resolves.toEqual({
      status: ElementGenerationBuildStatus.PREPARING_INPUT,
      syncLeaseOwner: null,
      syncLeaseUntil: null,
    })
  })

  it('does not treat an equal expiry timestamp as expired', async () => {
    const existingOwner = randomUUID()
    const build = await createBuild({
      syncLeaseOwner: existingOwner,
      syncLeaseUntil: NOW,
    })

    await expect(
      acquireElementGenerationLease(prisma, {
        buildId: build.id,
        ownerId,
        expectedStatus: ElementGenerationBuildStatus.PREPARING_INPUT,
        now: NOW,
      })
    ).resolves.toBeNull()

    await expect(
      prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: build.id },
        select: { syncLeaseOwner: true, syncLeaseUntil: true },
      })
    ).resolves.toEqual({
      syncLeaseOwner: existingOwner,
      syncLeaseUntil: NOW,
    })
  })

  it('allows an expired takeover and fences a stale release', async () => {
    const staleOwner = randomUUID()
    const build = await createBuild({
      syncLeaseOwner: staleOwner,
      syncLeaseUntil: new Date(NOW.getTime() - 1),
    })

    const successor = await acquireElementGenerationLease(prisma, {
      buildId: build.id,
      ownerId,
      now: NOW,
    })
    expect(successor).not.toBeNull()
    expect(successor).not.toBe(staleOwner)

    await expect(
      releaseElementGenerationLease(prisma, build.id, staleOwner)
    ).resolves.toBe(false)
    await expect(
      prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: build.id },
        select: { syncLeaseOwner: true, syncLeaseUntil: true },
      })
    ).resolves.toEqual({
      syncLeaseOwner: successor,
      syncLeaseUntil: new Date(NOW.getTime() + LEASE_DURATION_MILLISECONDS),
    })

    await expect(
      releaseElementGenerationLease(prisma, build.id, successor!)
    ).resolves.toBe(true)
  })

  it('allows a polling claim without a status predicate', async () => {
    const build = await createBuild({
      status: ElementGenerationBuildStatus.RUNNING,
    })

    const leaseOwner = await acquireElementGenerationLease(prisma, {
      buildId: build.id,
      ownerId,
      now: NOW,
    })
    expect(leaseOwner).not.toBeNull()

    await expect(
      prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: build.id },
        select: { status: true, syncLeaseOwner: true, syncLeaseUntil: true },
      })
    ).resolves.toEqual({
      status: ElementGenerationBuildStatus.RUNNING,
      syncLeaseOwner: leaseOwner,
      syncLeaseUntil: new Date(NOW.getTime() + LEASE_DURATION_MILLISECONDS),
    })

    await expect(
      releaseElementGenerationLease(prisma, build.id, leaseOwner!)
    ).resolves.toBe(true)
  })
})
