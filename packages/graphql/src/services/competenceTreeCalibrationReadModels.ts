import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import {
  competenceTreeServiceError,
  readableCompetenceTreeWhere,
} from './competenceTreeRepository.js'

export async function getCompetenceTreeCalibrationOverview(
  treeId: string,
  ctx: ContextWithUser
) {
  const hasPrivilegedScope = hasPsychometricReadScope(ctx)
  const isPersistedAdmin =
    hasPrivilegedScope && (await hasPersistedAdminRole(ctx))
  const tree = await ctx.prisma.competenceTree.findFirst({
    where: isPersistedAdmin
      ? { id: treeId, isDeleted: false }
      : {
          id: treeId,
          ...readableCompetenceTreeWhere(ctx.user.sub, true),
        },
    select: {
      id: true,
      name: true,
      ownerId: true,
      elementAssignments: {
        where: { enabled: true },
        select: { id: true, element: { select: { version: true } } },
      },
      scaleVersions: {
        where: { status: DB.AdaptiveScaleVersionStatus.ACTIVE },
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          version: true,
          calibrations: {
            orderBy: [{ assignmentId: 'asc' }, { version: 'desc' }],
            select: {
              assignmentId: true,
              elementVersion: true,
              status: true,
            },
          },
        },
      },
    },
  })
  if (!tree) {
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }

  const canManage = hasPrivilegedScope && tree.ownerId === ctx.user.sub
  const canViewPsychometrics =
    hasPrivilegedScope && (canManage || isPersistedAdmin)
  const readiness = buildCalibrationReadiness(tree, !canViewPsychometrics)
  if (!canViewPsychometrics) {
    // The current GraphQL scale type has non-null psychometric fields. Until a
    // dedicated readiness type exists, an empty scale collection is the only
    // honest redaction that cannot leak or fabricate protected values.
    return {
      treeId: tree.id,
      treeName: tree.name,
      canManage: false,
      readiness,
      scales: [],
    }
  }

  const scales = await ctx.prisma.competenceTreeScaleVersion.findMany({
    where: { treeId },
    orderBy: { version: 'desc' },
    include: {
      levels: { orderBy: { order: 'asc' } },
      approvals: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          method: true,
          methodVersion: true,
          panelSize: true,
          standardSettingDate: true,
          cutRationale: true,
          decision: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      calibrations: {
        orderBy: [
          { assignmentId: 'asc' },
          { elementVersion: 'asc' },
          { version: 'desc' },
        ],
        select: {
          id: true,
          assignmentId: true,
          elementId: true,
          elementVersion: true,
          version: true,
          model: true,
          status: true,
          discrimination: true,
          difficulty: true,
          guessing: true,
          parameterUncertainty: true,
          responseCount: true,
          participantCount: true,
          diagnostics: true,
          modelImplementationVersion: true,
          approvedAt: true,
          createdAt: true,
        },
      },
      sourceScaleLinks: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          fromScaleVersionId: true,
          toScaleVersionId: true,
          method: true,
          implementationVersion: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      targetScaleLinks: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          fromScaleVersionId: true,
          toScaleVersionId: true,
          method: true,
          implementationVersion: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      empiricalValidations: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          configId: true,
          status: true,
          measurementVersion: true,
          estimatorImplementationVersion: true,
          classificationPolicyVersion: true,
          calibrationPolicyVersion: true,
          approvedProbabilityThreshold: true,
          aggregateMetrics: true,
          stratumMetrics: true,
          submittedAt: true,
          reviewedAt: true,
        },
      },
    },
  })

  return {
    treeId: tree.id,
    treeName: tree.name,
    canManage,
    readiness,
    scales: scales.map((scale) => {
      const counts = countCalibrationStatuses(scale.calibrations)
      return {
        id: scale.id,
        version: scale.version,
        status: scale.status,
        supersedesVersionId: scale.supersedesVersionId,
        priorMean: scale.priorMean,
        priorStandardDeviation: scale.priorStandardDeviation,
        gridMin: scale.gridMin,
        gridMax: scale.gridMax,
        gridStep: scale.gridStep,
        classificationPolicyVersion: scale.classificationPolicyVersion,
        submittedForReviewAt: scale.submittedForReviewAt,
        createdAt: scale.createdAt,
        levels: scale.levels.map((level) => ({
          id: level.id,
          order: level.order,
          label: level.label,
          lowerBound: level.lowerBound,
          itemDifficultyPrior: level.itemDifficultyPrior,
          sourceLevelId: level.sourceLevelId,
        })),
        approvals: scale.approvals,
        scaleLinks: deduplicateById([
          ...scale.sourceScaleLinks,
          ...scale.targetScaleLinks,
        ]),
        empiricalValidations: scale.empiricalValidations,
        calibrationCounts: counts,
        calibrations: scale.calibrations,
      }
    }),
  }
}

function buildCalibrationReadiness(
  tree: {
    elementAssignments?: Array<{
      id: number
      element: { version: number }
    }>
    scaleVersions?: Array<{
      version: number
      calibrations: Array<{
        assignmentId: number
        elementVersion: number
        status: DB.AdaptiveItemCalibrationStatus
      }>
    }>
  },
  detailsRedacted: boolean
) {
  const activeScale = tree.scaleVersions?.[0] ?? null
  const assignments = tree.elementAssignments ?? []
  const exactCalibrationByAssignment = new Map<
    number,
    DB.AdaptiveItemCalibrationStatus
  >()
  for (const calibration of activeScale?.calibrations ?? []) {
    if (exactCalibrationByAssignment.has(calibration.assignmentId)) continue
    const assignment = assignments.find(
      ({ id }) => id === calibration.assignmentId
    )
    if (assignment?.element.version === calibration.elementVersion) {
      exactCalibrationByAssignment.set(
        calibration.assignmentId,
        calibration.status
      )
    }
  }
  const calibratedAssignmentCount = assignments.filter(
    ({ id }) =>
      exactCalibrationByAssignment.get(id) ===
      DB.AdaptiveItemCalibrationStatus.CALIBRATED
  ).length
  const blockingAssignmentCount = assignments.length - calibratedAssignmentCount

  return {
    status:
      activeScale === null
        ? ('NO_ACTIVE_SCALE' as const)
        : blockingAssignmentCount === 0 && assignments.length > 0
          ? ('CALIBRATED_BANK' as const)
          : ('CALIBRATION_INCOMPLETE' as const),
    activeScaleVersion: activeScale?.version ?? null,
    enabledAssignmentCount: assignments.length,
    calibratedAssignmentCount,
    blockingAssignmentCount,
    detailsRedacted,
  }
}

export type CompetenceTreeCalibrationOverview = Awaited<
  ReturnType<typeof getCompetenceTreeCalibrationOverview>
>
export type CompetenceTreeCalibrationReadinessOverview =
  CompetenceTreeCalibrationOverview['readiness']
export type CompetenceTreeScaleOverview =
  CompetenceTreeCalibrationOverview['scales'][number]
export type CompetenceTreeScaleLevelOverview =
  CompetenceTreeScaleOverview['levels'][number]
export type CompetenceTreeScaleApprovalOverview =
  CompetenceTreeScaleOverview['approvals'][number]
export type CompetenceTreeScaleLinkOverview =
  CompetenceTreeScaleOverview['scaleLinks'][number]
export type AdaptiveItemCalibrationOverview =
  CompetenceTreeScaleOverview['calibrations'][number]
export type AdaptiveEmpiricalValidationOverview =
  CompetenceTreeScaleOverview['empiricalValidations'][number]

export async function getComparableCalibrationTrend(
  {
    treeId,
    fromScaleVersionId,
    toScaleVersionId,
  }: {
    treeId: string
    fromScaleVersionId: string
    toScaleVersionId: string
  },
  ctx: ContextWithUser
) {
  if (!hasPsychometricReadScope(ctx)) {
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }
  const isPersistedAdmin = await hasPersistedAdminRole(ctx)
  const tree = await ctx.prisma.competenceTree.findFirst({
    where: isPersistedAdmin
      ? { id: treeId, isDeleted: false }
      : { id: treeId, ownerId: ctx.user.sub, isDeleted: false },
    select: { id: true },
  })
  if (!tree) {
    throw competenceTreeServiceError('Competence tree not found.', 'NOT_FOUND')
  }

  const link = await ctx.prisma.competenceTreeScaleLink.findFirst({
    where: {
      treeId,
      fromScaleVersionId,
      toScaleVersionId,
      status: DB.AdaptiveScaleLinkStatus.APPROVED,
    },
    select: {
      id: true,
      method: true,
      implementationVersion: true,
      fitMetrics: true,
      uncertaintyMetrics: true,
      anchors: {
        orderBy: { order: 'asc' },
        select: {
          fromCalibrationId: true,
          toCalibrationId: true,
          fromCalibration: {
            select: {
              assignmentId: true,
              elementId: true,
              elementVersion: true,
              difficulty: true,
            },
          },
          toCalibration: {
            select: {
              assignmentId: true,
              elementId: true,
              elementVersion: true,
              difficulty: true,
            },
          },
        },
      },
    },
  })
  if (!link) {
    throw competenceTreeServiceError(
      'An approved scale link is required for cross-version trends.',
      'ADAPTIVE_SCALE_LINK_REQUIRED'
    )
  }
  return link
}

function hasPsychometricReadScope(ctx: ContextWithUser) {
  return (
    ctx.user.scope === DB.UserLoginScope.FULL_ACCESS ||
    ctx.user.scope === DB.UserLoginScope.ACCOUNT_OWNER
  )
}

async function hasPersistedAdminRole(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.ADMIN) return false
  return (
    (
      await ctx.prisma.user.findUnique({
        where: { id: ctx.user.sub },
        select: { role: true },
      })
    )?.role === DB.UserRole.ADMIN
  )
}

function countCalibrationStatuses(
  calibrations: Array<{ status: DB.AdaptiveItemCalibrationStatus }>
) {
  const counts: Record<DB.AdaptiveItemCalibrationStatus, number> = {
    PROVISIONAL: 0,
    PILOT: 0,
    CALIBRATED: 0,
    FLAGGED: 0,
    RETIRED: 0,
  }
  calibrations.forEach(({ status }) => {
    counts[status] += 1
  })
  return counts
}

function deduplicateById<T extends { id: string }>(values: T[]) {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}
