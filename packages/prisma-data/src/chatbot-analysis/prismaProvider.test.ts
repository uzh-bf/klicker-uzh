import { prisma } from '@klicker-uzh/prisma'
import { afterAll, describe, expect, it } from 'vitest'

import { createPrismaAnalysisRecordProvider } from './prismaProvider.js'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('Prisma chatbot analysis provider', () => {
  it('fails closed while authoritative eligibility is unavailable', async () => {
    const provider = createPrismaAnalysisRecordProvider('course-1')

    await expect(
      provider.loadEligibility({
        participantIds: ['participant-1'],
        purpose: 'learning-analytics',
        courseIds: ['course-1'],
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-02T00:00:00.000Z'),
      })
    ).resolves.toEqual([])
  })
})
