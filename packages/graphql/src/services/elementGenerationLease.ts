import { randomUUID } from 'node:crypto'
import type * as DB from '@klicker-uzh/prisma/client'

const ELEMENT_GENERATION_LEASE_MILLISECONDS = 15_000

type ElementGenerationLeaseClient = Pick<
  DB.PrismaClient,
  'elementGenerationBuild'
>

type ElementGenerationLeaseExpectedStatus =
  | typeof DB.ElementGenerationBuildStatus.PREPARING_INPUT
  | typeof DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW
  | typeof DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW

type AcquireElementGenerationLeaseInput = {
  buildId: string
  ownerId: string
  expectedStatus?: ElementGenerationLeaseExpectedStatus
  now?: Date
}

export async function acquireElementGenerationLease(
  prisma: ElementGenerationLeaseClient,
  input: AcquireElementGenerationLeaseInput
): Promise<string | null> {
  const now = input.now ?? new Date()
  const leaseOwner = randomUUID()
  const acquired = await prisma.elementGenerationBuild.updateMany({
    where: {
      id: input.buildId,
      ownerId: input.ownerId,
      ...(input.expectedStatus !== undefined
        ? { status: input.expectedStatus }
        : {}),
      OR: [{ syncLeaseUntil: null }, { syncLeaseUntil: { lt: now } }],
    },
    data: {
      syncLeaseOwner: leaseOwner,
      syncLeaseUntil: new Date(
        now.getTime() + ELEMENT_GENERATION_LEASE_MILLISECONDS
      ),
    },
  })

  return acquired.count === 1 ? leaseOwner : null
}

export async function releaseElementGenerationLease(
  prisma: ElementGenerationLeaseClient,
  buildId: string,
  leaseOwner: string
): Promise<boolean> {
  const released = await prisma.elementGenerationBuild.updateMany({
    where: { id: buildId, syncLeaseOwner: leaseOwner },
    data: { syncLeaseOwner: null, syncLeaseUntil: null },
  })

  return released.count === 1
}
