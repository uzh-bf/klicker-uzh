import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import {
  MAX_ADAPTIVE_SCALE_LINK_ANCHORS,
  parseAdaptiveScaleLinkArtifact,
  parseAdaptiveStandardSettingArtifact,
  type AdaptiveScaleLinkArtifact,
  type AdaptiveStandardSettingArtifact,
} from './competenceTreeCalibrationArtifact.js'
import {
  assertScaleIdentity,
  parseArtifact,
} from './competenceTreeCalibrationCommandUtils.js'
import {
  assertAdaptiveReviewer,
  calibrationServiceError,
  calibrationTransaction,
  lockOwnedCalibrationTree,
  lockScaleLink,
  lockScaleVersion,
} from './competenceTreeCalibrationRepository.js'

export type CompetenceTreeScaleLevelInput = {
  sourceLevelId: number
  lowerBound?: number | null
  itemDifficultyPrior: number
}

export const SCALE_LINK_CALIBRATION_BATCH_SIZE = 500

export type CreateCompetenceTreeScaleVersionInput = {
  treeId: string
  supersedesVersionId?: string | null
  priorMean?: number
  priorStandardDeviation?: number
  gridMin?: number
  gridMax?: number
  gridStep?: number
  classificationPolicyVersion?: number
  levels?: CompetenceTreeScaleLevelInput[] | null
}

export async function createCompetenceTreeScaleVersion(
  input: CreateCompetenceTreeScaleVersionInput,
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    await lockOwnedCalibrationTree(tx, input.treeId, ctx)
    const tree = await tx.competenceTree.findUniqueOrThrow({
      where: { id: input.treeId },
      select: {
        thetaMin: true,
        thetaMax: true,
        levelMappingRule: true,
        levels: { orderBy: { order: 'asc' } },
        scaleVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true },
        },
      },
    })
    if (tree.levels.length < 2) {
      throw calibrationServiceError(
        'A scale requires at least two ordered competence-tree levels.',
        'ADAPTIVE_SCALE_LEVELS_REQUIRED'
      )
    }

    const gridMin = input.gridMin ?? Math.min(-6, tree.thetaMin)
    const gridMax = input.gridMax ?? Math.max(6, tree.thetaMax)
    const levels = prepareScaleLevels(input.levels, tree)
    validateScaleGeometry(levels, gridMin, gridMax)

    if (input.supersedesVersionId) {
      const previous = await lockScaleVersion(tx, input.supersedesVersionId)
      if (previous.treeId !== input.treeId) {
        throw calibrationServiceError(
          'A scale can only supersede a version of the same tree.',
          'ADAPTIVE_SCALE_IDENTITY_MISMATCH'
        )
      }
    }

    return tx.competenceTreeScaleVersion.create({
      data: {
        version: (tree.scaleVersions[0]?.version ?? 0) + 1,
        priorMean: input.priorMean ?? 0,
        priorStandardDeviation: input.priorStandardDeviation ?? 1,
        gridMin,
        gridMax,
        gridStep: input.gridStep ?? 0.1,
        classificationPolicyVersion: input.classificationPolicyVersion ?? 1,
        treeId: input.treeId,
        supersedesVersionId: input.supersedesVersionId ?? null,
        createdById: ctx.user.sub,
        levels: {
          create: levels.map((level) => ({
            order: level.order,
            label: level.label,
            lowerBound: level.lowerBound,
            itemDifficultyPrior: level.itemDifficultyPrior,
            treeId: input.treeId,
            sourceLevelId: level.sourceLevelId,
          })),
        },
      },
      include: { levels: { orderBy: { order: 'asc' } } },
    })
  })
}

export async function submitCompetenceTreeScaleForReview(
  artifactInput: unknown,
  ctx: ContextWithUser
) {
  const artifact = parseArtifact(
    artifactInput,
    parseAdaptiveStandardSettingArtifact,
    'ADAPTIVE_STANDARD_SETTING_ARTIFACT_INVALID'
  )
  return calibrationTransaction(ctx, async (tx) => {
    await lockOwnedCalibrationTree(tx, artifact.treeId, ctx)
    const scale = await lockScaleVersion(tx, artifact.scaleVersionId)
    assertScaleIdentity(scale, artifact.treeId)
    if (scale.status !== DB.AdaptiveScaleVersionStatus.DRAFT) {
      throw calibrationServiceError(
        'Only a draft scale can be submitted for review.',
        'ADAPTIVE_SCALE_NOT_DRAFT'
      )
    }

    const levels = await tx.competenceTreeScaleLevel.findMany({
      where: { scaleVersionId: scale.id },
      orderBy: { order: 'asc' },
    })
    assertCutRationaleCoverage(artifact, levels)

    const approval = await tx.competenceTreeScaleApproval.create({
      data: {
        treeId: artifact.treeId,
        scaleVersionId: scale.id,
        method: artifact.method,
        methodVersion: artifact.methodVersion,
        panelSize: artifact.panelSize,
        standardSettingDate: new Date(artifact.standardSettingDate),
        cutRationale: artifact.cutRationale,
        artifactChecksum: artifact.artifactChecksum,
        artifactKey: artifact.artifactKey,
        submittedById: ctx.user.sub,
      },
    })
    await tx.competenceTreeScaleVersion.update({
      where: { id: scale.id },
      data: {
        status: DB.AdaptiveScaleVersionStatus.IN_REVIEW,
        submittedForReviewAt: new Date(),
      },
    })
    return approval
  })
}

export async function reviewCompetenceTreeScale(
  {
    scaleVersionId,
    decision,
  }: {
    scaleVersionId: string
    decision: 'APPROVED' | 'REJECTED'
  },
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    await assertAdaptiveReviewer(tx, ctx)
    const scale = await lockScaleVersion(tx, scaleVersionId)
    if (scale.createdById === ctx.user.sub) {
      throw calibrationServiceError(
        'A scale creator cannot review their own scale.',
        'ADAPTIVE_INDEPENDENT_REVIEW_REQUIRED'
      )
    }
    if (scale.status !== DB.AdaptiveScaleVersionStatus.IN_REVIEW) {
      throw calibrationServiceError(
        'The scale is not awaiting review.',
        'ADAPTIVE_SCALE_NOT_IN_REVIEW'
      )
    }

    const evidence = await tx.competenceTreeScaleApproval.findFirst({
      where: { scaleVersionId, decision: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!evidence) {
      throw calibrationServiceError(
        'Standard-setting evidence is missing.',
        'ADAPTIVE_STANDARD_SETTING_EVIDENCE_REQUIRED'
      )
    }
    const status =
      decision === 'APPROVED'
        ? DB.AdaptiveScaleVersionStatus.APPROVED
        : DB.AdaptiveScaleVersionStatus.REJECTED
    const reviewedAt = new Date()
    await tx.competenceTreeScaleApproval.update({
      where: { id: evidence.id },
      data: { decision: status, reviewerId: ctx.user.sub, reviewedAt },
    })
    return tx.competenceTreeScaleVersion.update({
      where: { id: scaleVersionId },
      data: { status },
      include: { levels: { orderBy: { order: 'asc' } }, approvals: true },
    })
  })
}

export async function activateCompetenceTreeScaleVersion(
  { scaleVersionId }: { scaleVersionId: string },
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    const scaleIdentity = await tx.competenceTreeScaleVersion.findUnique({
      where: { id: scaleVersionId },
      select: { treeId: true },
    })
    if (!scaleIdentity) {
      throw calibrationServiceError('Scale version not found.', 'NOT_FOUND')
    }
    await lockOwnedCalibrationTree(tx, scaleIdentity.treeId, ctx)
    const scale = await lockScaleVersion(tx, scaleVersionId)
    assertScaleIdentity(scale, scaleIdentity.treeId)
    if (scale.status !== DB.AdaptiveScaleVersionStatus.APPROVED) {
      throw calibrationServiceError(
        'Only an approved scale can become active.',
        'ADAPTIVE_SCALE_NOT_APPROVED'
      )
    }

    const active = await tx.competenceTreeScaleVersion.findFirst({
      where: {
        treeId: scale.treeId,
        status: DB.AdaptiveScaleVersionStatus.ACTIVE,
      },
      select: { id: true },
    })
    if (active && scale.supersedesVersionId !== active.id) {
      throw calibrationServiceError(
        'The approved scale does not supersede the active scale.',
        'ADAPTIVE_SCALE_SUPERSESSION_MISMATCH'
      )
    }
    if (active) {
      await lockScaleVersion(tx, active.id)
      await tx.competenceTreeScaleVersion.update({
        where: { id: active.id },
        data: { status: DB.AdaptiveScaleVersionStatus.SUPERSEDED },
      })
    }
    return tx.competenceTreeScaleVersion.update({
      where: { id: scale.id },
      data: { status: DB.AdaptiveScaleVersionStatus.ACTIVE },
      include: { levels: { orderBy: { order: 'asc' } } },
    })
  })
}

export async function submitCompetenceTreeScaleLink(
  artifactInput: unknown,
  ctx: ContextWithUser
) {
  const artifact = parseArtifact(
    artifactInput,
    parseAdaptiveScaleLinkArtifact,
    'ADAPTIVE_SCALE_LINK_ARTIFACT_INVALID'
  )
  return calibrationTransaction(ctx, async (tx) => {
    await lockOwnedCalibrationTree(tx, artifact.treeId, ctx)
    const fromScale = await lockScaleVersion(tx, artifact.fromScaleVersionId)
    const toScale = await lockScaleVersion(tx, artifact.toScaleVersionId)
    assertScaleIdentity(fromScale, artifact.treeId)
    assertScaleIdentity(toScale, artifact.treeId)
    if (toScale.supersedesVersionId !== fromScale.id) {
      throw calibrationServiceError(
        'The target scale must explicitly supersede the source scale.',
        'ADAPTIVE_SCALE_SUPERSESSION_MISMATCH'
      )
    }
    if (toScale.status !== DB.AdaptiveScaleVersionStatus.APPROVED) {
      throw calibrationServiceError(
        'The target scale must be approved before linking.',
        'ADAPTIVE_SCALE_NOT_APPROVED'
      )
    }
    await assertScaleLinkAnchors(tx, artifact)

    const link = await tx.competenceTreeScaleLink.create({
      data: {
        treeId: artifact.treeId,
        fromScaleVersionId: artifact.fromScaleVersionId,
        toScaleVersionId: artifact.toScaleVersionId,
        method: artifact.method,
        implementationVersion: artifact.implementationVersion,
        fitMetrics: artifact.fitMetrics,
        uncertaintyMetrics: artifact.uncertaintyMetrics,
        artifactChecksum: artifact.artifactChecksum,
        artifactKey: artifact.artifactKey,
        createdById: ctx.user.sub,
        anchors: {
          create: artifact.anchors.map((anchor, order) => ({
            order,
            fromCalibrationId: anchor.fromCalibrationId,
            toCalibrationId: anchor.toCalibrationId,
          })),
        },
      },
    })
    return tx.competenceTreeScaleLink.update({
      where: { id: link.id },
      data: {
        status: DB.AdaptiveScaleLinkStatus.IN_REVIEW,
        submittedForReviewAt: new Date(),
      },
      include: { anchors: { orderBy: { order: 'asc' } } },
    })
  })
}

export async function reviewCompetenceTreeScaleLink(
  {
    scaleLinkId,
    decision,
  }: {
    scaleLinkId: string
    decision: 'APPROVED' | 'REJECTED'
  },
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    await assertAdaptiveReviewer(tx, ctx)
    const link = await lockScaleLink(tx, scaleLinkId)
    if (link.createdById === ctx.user.sub) {
      throw calibrationServiceError(
        'A scale-link creator cannot review their own link.',
        'ADAPTIVE_INDEPENDENT_REVIEW_REQUIRED'
      )
    }
    if (link.status !== DB.AdaptiveScaleLinkStatus.IN_REVIEW) {
      throw calibrationServiceError(
        'The scale link is not awaiting review.',
        'ADAPTIVE_SCALE_LINK_NOT_IN_REVIEW'
      )
    }
    return tx.competenceTreeScaleLink.update({
      where: { id: link.id },
      data: {
        status:
          decision === 'APPROVED'
            ? DB.AdaptiveScaleLinkStatus.APPROVED
            : DB.AdaptiveScaleLinkStatus.REJECTED,
        reviewedById: ctx.user.sub,
        reviewedAt: new Date(),
      },
      include: { anchors: { orderBy: { order: 'asc' } } },
    })
  })
}

function prepareScaleLevels(
  inputLevels: CompetenceTreeScaleLevelInput[] | null | undefined,
  tree: {
    thetaMin: number
    thetaMax: number
    levelMappingRule: DB.AdaptiveLevelMappingRule
    levels: Array<{ id: number; label: string; order: number }>
  }
) {
  const supplied = new Map(
    inputLevels?.map((level) => [level.sourceLevelId, level]) ?? []
  )
  if (inputLevels && supplied.size !== tree.levels.length) {
    throw calibrationServiceError(
      'Scale levels must map every current competence-tree level exactly once.',
      'ADAPTIVE_SCALE_LEVEL_IDENTITY_MISMATCH'
    )
  }
  const count = tree.levels.length
  const span = tree.thetaMax - tree.thetaMin
  const anchors = tree.levels.map((level) =>
    count === 1
      ? (tree.thetaMin + tree.thetaMax) / 2
      : tree.levelMappingRule === DB.AdaptiveLevelMappingRule.NEAREST
        ? tree.thetaMin + (span * level.order) / (count - 1)
        : tree.thetaMin + (span * level.order) / count
  )
  return tree.levels.map((level) => {
    const suppliedLevel = supplied.get(level.id)
    if (inputLevels && !suppliedLevel) {
      throw calibrationServiceError(
        'Scale levels contain a foreign or missing source level.',
        'ADAPTIVE_SCALE_LEVEL_IDENTITY_MISMATCH'
      )
    }
    return {
      sourceLevelId: level.id,
      order: level.order,
      label: level.label,
      itemDifficultyPrior:
        suppliedLevel?.itemDifficultyPrior ?? anchors[level.order]!,
      lowerBound:
        level.order === 0
          ? null
          : (suppliedLevel?.lowerBound ??
            (tree.levelMappingRule === DB.AdaptiveLevelMappingRule.NEAREST
              ? (anchors[level.order - 1]! + anchors[level.order]!) / 2
              : anchors[level.order]!)),
    }
  })
}

function validateScaleGeometry(
  levels: Array<{
    order: number
    lowerBound: number | null
    itemDifficultyPrior: number
  }>,
  gridMin: number,
  gridMax: number
) {
  if (
    !Number.isFinite(gridMin) ||
    !Number.isFinite(gridMax) ||
    gridMin >= gridMax
  ) {
    throw calibrationServiceError(
      'Scale grid bounds must be finite and increasing.',
      'ADAPTIVE_SCALE_GEOMETRY_INVALID'
    )
  }
  levels.forEach((level, index) => {
    const previous = levels[index - 1]
    if (
      level.order !== index ||
      !Number.isFinite(level.itemDifficultyPrior) ||
      level.itemDifficultyPrior < gridMin ||
      level.itemDifficultyPrior > gridMax ||
      (index === 0 && level.lowerBound !== null) ||
      (index > 0 &&
        (level.lowerBound === null ||
          !Number.isFinite(level.lowerBound) ||
          level.lowerBound <= previous!.itemDifficultyPrior ||
          level.lowerBound > level.itemDifficultyPrior ||
          level.itemDifficultyPrior <= previous!.itemDifficultyPrior))
    ) {
      throw calibrationServiceError(
        'Scale cuts and priors must be finite, contiguous, and increasing.',
        'ADAPTIVE_SCALE_GEOMETRY_INVALID'
      )
    }
  })
}

function assertCutRationaleCoverage(
  artifact: AdaptiveStandardSettingArtifact,
  levels: Array<{ order: number }>
) {
  const expected = levels
    .filter(({ order }) => order > 0)
    .map(({ order }) => order)
  const actual = artifact.cutRationale
    .map(({ scaleLevelOrder }) => scaleLevelOrder)
    .sort((left, right) => left - right)
  if (
    expected.length !== actual.length ||
    expected.some((v, i) => v !== actual[i])
  ) {
    throw calibrationServiceError(
      'Standard-setting evidence must explain every scale cut exactly once.',
      'ADAPTIVE_STANDARD_SETTING_CUT_EVIDENCE_INCOMPLETE'
    )
  }
}

export async function assertScaleLinkAnchors(
  tx: DB.Prisma.TransactionClient,
  artifact: AdaptiveScaleLinkArtifact
) {
  if (artifact.anchors.length > MAX_ADAPTIVE_SCALE_LINK_ANCHORS) {
    throw calibrationServiceError(
      'The scale link contains too many anchors.',
      'ADAPTIVE_SCALE_LINK_ANCHOR_LIMIT_EXCEEDED'
    )
  }

  const calibrationIds = [
    ...new Set(
      artifact.anchors.flatMap((anchor) => [
        anchor.fromCalibrationId,
        anchor.toCalibrationId,
      ])
    ),
  ]
  const calibrations = new Map<
    string,
    Awaited<
      ReturnType<
        DB.Prisma.TransactionClient['adaptiveItemCalibration']['findFirst']
      >
    >
  >()
  for (
    let offset = 0;
    offset < calibrationIds.length;
    offset += SCALE_LINK_CALIBRATION_BATCH_SIZE
  ) {
    const batch = await tx.adaptiveItemCalibration.findMany({
      where: {
        id: {
          in: calibrationIds.slice(
            offset,
            offset + SCALE_LINK_CALIBRATION_BATCH_SIZE
          ),
        },
      },
    })
    batch.forEach((calibration) =>
      calibrations.set(calibration.id, calibration)
    )
  }

  for (const anchor of artifact.anchors) {
    const from = calibrations.get(anchor.fromCalibrationId)
    const to = calibrations.get(anchor.toCalibrationId)
    if (
      !from ||
      !to ||
      from.treeId !== artifact.treeId ||
      to.treeId !== artifact.treeId ||
      from.scaleVersionId !== artifact.fromScaleVersionId ||
      to.scaleVersionId !== artifact.toScaleVersionId ||
      from.assignmentId !== to.assignmentId ||
      from.elementId !== to.elementId ||
      from.elementVersion !== to.elementVersion ||
      from.status !== DB.AdaptiveItemCalibrationStatus.CALIBRATED ||
      to.status !== DB.AdaptiveItemCalibrationStatus.CALIBRATED
    ) {
      throw calibrationServiceError(
        'A scale-link anchor does not match an exact calibrated item pair.',
        'ADAPTIVE_SCALE_LINK_ANCHOR_MISMATCH'
      )
    }
  }
}
