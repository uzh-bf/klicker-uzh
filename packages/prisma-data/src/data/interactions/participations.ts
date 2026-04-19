import type { PrismaClient } from '@klicker-uzh/prisma/client'

// Ensures a participant is enrolled in a given course. Uses createMany with
// skipDuplicates so it's safe to re-run against an already-seeded database.
export async function ensureParticipations({
  prisma,
  courseId,
  participantIds,
}: {
  prisma: PrismaClient
  courseId: string
  participantIds: readonly string[]
}): Promise<number> {
  if (participantIds.length === 0) return 0

  const result = await prisma.participation.createMany({
    data: participantIds.map((participantId) => ({
      courseId,
      participantId,
      isActive: true,
    })),
    skipDuplicates: true,
  })
  return result.count
}
