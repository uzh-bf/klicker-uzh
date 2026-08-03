import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { approveAdaptiveItemCalibration } from '../src/services/competenceTreeCalibrationItemCommands.js'
import { assertAdaptiveReviewer } from '../src/services/competenceTreeCalibrationRepository.js'
import {
  reviewCompetenceTreeScale,
  reviewCompetenceTreeScaleLink,
} from '../src/services/competenceTreeCalibrationScaleCommands.js'
import {
  reviewAdaptiveEmpiricalValidation,
  setCourseAdaptiveCalibrationCollectionEnabled,
} from '../src/services/competenceTreeCalibrationValidationCommands.js'

const id = '10000000-0000-4000-8000-000000000001'

describe('adaptive calibration reviewer permissions', () => {
  it('accepts a matching persisted administrator under a shared row lock', async () => {
    const { ctx, queryRaw, tx } = reviewerContext(DB.UserRole.ADMIN)

    await expect(
      assertAdaptiveReviewer(tx as never, ctx)
    ).resolves.toBeUndefined()

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(queryRaw.mock.calls[0]![0].join(' ')).toContain('FOR SHARE')
  })

  it.each([
    [
      'scale review',
      (ctx: ContextWithUser) =>
        reviewCompetenceTreeScale(
          { scaleVersionId: id, decision: 'APPROVED' },
          ctx
        ),
    ],
    [
      'scale-link review',
      (ctx: ContextWithUser) =>
        reviewCompetenceTreeScaleLink(
          { scaleLinkId: id, decision: 'APPROVED' },
          ctx
        ),
    ],
    [
      'item-calibration approval',
      (ctx: ContextWithUser) =>
        approveAdaptiveItemCalibration({ calibrationId: id }, ctx),
    ],
    [
      'empirical-validation review',
      (ctx: ContextWithUser) =>
        reviewAdaptiveEmpiricalValidation(
          { validationId: id, decision: 'APPROVED' },
          ctx
        ),
    ],
    [
      'calibration-collection administration',
      (ctx: ContextWithUser) =>
        setCourseAdaptiveCalibrationCollectionEnabled(
          { courseId: id, enabled: true },
          ctx
        ),
    ],
  ])('rejects a demoted administrator before %s', async (_, operation) => {
    const { ctx, queryRaw } = reviewerContext(DB.UserRole.USER)

    await expect(operation(ctx)).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    })

    expect(queryRaw).toHaveBeenCalledTimes(1)
    const reviewerLockSql = queryRaw.mock.calls[0]![0].join(' ')
    expect(reviewerLockSql).toContain('FROM "User"')
    expect(reviewerLockSql).toContain('FOR SHARE')
  })
})

function reviewerContext(persistedRole: DB.UserRole) {
  const queryRaw = vi.fn().mockResolvedValue([{ role: persistedRole }])
  const tx = { $queryRaw: queryRaw }
  const transaction = vi.fn(
    async (operation: (value: typeof tx) => Promise<unknown>) =>
      await operation(tx)
  )
  const ctx = {
    user: {
      sub: id,
      role: DB.UserRole.ADMIN,
      scope: DB.UserLoginScope.FULL_ACCESS,
    },
    prisma: { $transaction: transaction },
  } as unknown as ContextWithUser
  return { ctx, queryRaw, tx }
}
