import { AdaptiveScaleVersionStatus, Prisma } from '@klicker-uzh/prisma/client'

type FixtureScaleLevel = {
  id: number
  label: string
  order: number
}

export async function createReviewedActiveScale({
  tx,
  treeId,
  levels,
  creatorId,
  reviewerId,
  artifactKey,
  lowerBounds,
  itemDifficultyPriors,
  gridMin = -6,
  gridMax = 6,
}: {
  tx: Prisma.TransactionClient
  treeId: string
  levels: FixtureScaleLevel[]
  creatorId: string
  reviewerId: string
  artifactKey: string
  lowerBounds: Array<number | null>
  itemDifficultyPriors: number[]
  gridMin?: number
  gridMax?: number
}) {
  if (creatorId === reviewerId) {
    throw new Error('Adaptive scale fixtures require an independent reviewer.')
  }
  if (
    lowerBounds.length !== levels.length ||
    itemDifficultyPriors.length !== levels.length
  ) {
    throw new Error('Adaptive scale fixture arrays must match the level count.')
  }

  const scale = await tx.competenceTreeScaleVersion.create({
    data: {
      treeId,
      version: 1,
      priorMean: 0,
      priorStandardDeviation: 1,
      gridMin,
      gridMax,
      gridStep: 0.1,
      classificationPolicyVersion: 1,
      createdById: creatorId,
      levels: {
        create: levels.map((level, index) => ({
          sourceLevelId: level.id,
          order: level.order,
          label: level.label,
          lowerBound: lowerBounds[index]!,
          itemDifficultyPrior: itemDifficultyPriors[index]!,
        })),
      },
    },
  })
  const approval = await tx.competenceTreeScaleApproval.create({
    data: {
      treeId,
      scaleVersionId: scale.id,
      method: 'BOOKMARK',
      methodVersion: 'playwright-fixture-v1',
      panelSize: 3,
      standardSettingDate: new Date('2026-07-01T00:00:00.000Z'),
      cutRationale: levels.slice(1).map((level) => ({
        scaleLevelOrder: level.order,
        codes: ['DETERMINISTIC_TEST_FIXTURE'],
      })),
      artifactChecksum: 'a'.repeat(64),
      artifactKey: `test/playwright/${artifactKey}/standard-setting.json`,
      submittedById: creatorId,
    },
  })
  await tx.competenceTreeScaleVersion.update({
    where: { id: scale.id },
    data: {
      status: AdaptiveScaleVersionStatus.IN_REVIEW,
      submittedForReviewAt: new Date('2026-07-02T00:00:00.000Z'),
    },
  })
  await tx.competenceTreeScaleApproval.update({
    where: { id: approval.id },
    data: {
      decision: AdaptiveScaleVersionStatus.APPROVED,
      reviewerId,
      reviewedAt: new Date('2026-07-03T00:00:00.000Z'),
    },
  })
  await tx.competenceTreeScaleVersion.update({
    where: { id: scale.id },
    data: { status: AdaptiveScaleVersionStatus.APPROVED },
  })
  return tx.competenceTreeScaleVersion.update({
    where: { id: scale.id },
    data: { status: AdaptiveScaleVersionStatus.ACTIVE },
    include: { levels: { orderBy: { order: 'asc' } } },
  })
}
