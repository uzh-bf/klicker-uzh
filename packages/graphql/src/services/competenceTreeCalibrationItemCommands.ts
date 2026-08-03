import {
  deriveGuessingParameter,
  type AdaptiveItemType,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import {
  parseAdaptiveCalibrationArtifact,
  type AdaptiveCalibrationArtifact,
} from './competenceTreeCalibrationArtifact.js'
import {
  assertScaleIdentity,
  checksum,
  parseArtifact,
} from './competenceTreeCalibrationCommandUtils.js'
import {
  assertAdaptiveReviewer,
  calibrationServiceError,
  calibrationTransaction,
  lockCalibration,
  lockOwnedCalibrationTree,
  lockScaleVersion,
} from './competenceTreeCalibrationRepository.js'
import { getAccessibleCompetenceTreeElement } from './competenceTreeRepository.js'

const MINIMUM_CALIBRATION_RESPONSES = 100
const MINIMUM_CALIBRATION_PARTICIPANTS = 100

export async function submitAdaptiveItemCalibrationCandidates(
  artifactInput: unknown,
  ctx: ContextWithUser
) {
  const artifact = parseArtifact(
    artifactInput,
    parseAdaptiveCalibrationArtifact,
    'ADAPTIVE_CALIBRATION_ARTIFACT_INVALID'
  )
  return calibrationTransaction(ctx, async (tx) => {
    await lockOwnedCalibrationTree(tx, artifact.treeId, ctx)
    const scale = await lockScaleVersion(tx, artifact.scaleVersionId)
    assertScaleIdentity(scale, artifact.treeId)
    const acceptedScaleStatuses: DB.AdaptiveScaleVersionStatus[] = [
      DB.AdaptiveScaleVersionStatus.DRAFT,
      DB.AdaptiveScaleVersionStatus.APPROVED,
      DB.AdaptiveScaleVersionStatus.ACTIVE,
    ]
    if (!acceptedScaleStatuses.includes(scale.status)) {
      throw calibrationServiceError(
        'The scale does not accept calibration candidates.',
        'ADAPTIVE_SCALE_CALIBRATION_CLOSED'
      )
    }

    const calibrationDataset =
      await tx.adaptiveCalibrationExportRequest.findFirst({
        where: {
          treeId: artifact.treeId,
          scaleVersionId: artifact.scaleVersionId,
          datasetVersion: artifact.datasetVersion,
          artifactChecksum: artifact.datasetChecksum,
          status: DB.AdaptiveCalibrationExportStatus.READY,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      })
    if (!calibrationDataset) {
      throw calibrationServiceError(
        'The calibration dataset does not match a ready, unexpired export.',
        'ADAPTIVE_CALIBRATION_DATASET_NOT_VERIFIED'
      )
    }

    const created: DB.AdaptiveItemCalibration[] = []
    for (const candidate of artifact.calibrations) {
      const assignment = await tx.competenceTreeElementAssignment.findUnique({
        where: { id: candidate.assignmentId },
        select: { id: true, treeId: true, elementId: true },
      })
      if (!assignment || assignment.treeId !== artifact.treeId) {
        throw calibrationServiceError(
          'A calibration assignment does not belong to the selected tree.',
          'ADAPTIVE_CALIBRATION_ASSIGNMENT_MISMATCH'
        )
      }
      const element = await getAccessibleCompetenceTreeElement(
        assignment.elementId,
        ctx.user.sub,
        tx
      )
      if (element.version !== candidate.elementVersion) {
        throw calibrationServiceError(
          'A calibration targets a stale element version.',
          'ADAPTIVE_CALIBRATION_ELEMENT_VERSION_MISMATCH'
        )
      }
      assertCalibrationModel(element.type, element.options, candidate)

      const latest = await tx.adaptiveItemCalibration.findFirst({
        where: {
          treeId: artifact.treeId,
          scaleVersionId: artifact.scaleVersionId,
          assignmentId: assignment.id,
          elementId: element.id,
          elementVersion: element.version,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      const parameterUncertainty: PrismaJson.PrismaAdaptiveParameterUncertainty =
        {
          discriminationStandardError: candidate.discriminationStandardError,
          difficultyStandardError: candidate.difficultyStandardError,
          guessingStandardError: null,
          discriminationInterval: null,
          difficultyInterval: null,
          guessingInterval: null,
        }
      const diagnostics: PrismaJson.PrismaAdaptiveCalibrationDiagnostics = {
        fitStatus: candidate.diagnostics.fitStatus,
        difStatus: candidate.diagnostics.difStatus,
        driftStatus: candidate.diagnostics.driftStatus,
        fitStatistics: {
          fitStatistic: candidate.diagnostics.fitStatistic,
          holdoutLogLoss: candidate.diagnostics.holdoutLogLoss,
        },
        warningCodes: candidate.diagnostics.codes,
        dif: {
          status: candidate.diagnostics.difStatus,
          effect: candidate.diagnostics.difEffect,
        },
        drift: {
          status: candidate.diagnostics.driftStatus,
          effect: candidate.diagnostics.driftEffect,
        },
      }
      created.push(
        await tx.adaptiveItemCalibration.create({
          data: {
            version: (latest?.version ?? 0) + 1,
            model: candidate.model,
            status: DB.AdaptiveItemCalibrationStatus.PILOT,
            discrimination: candidate.discrimination,
            difficulty: candidate.difficulty,
            guessing: candidate.guessing,
            parameterUncertainty,
            responseCount: candidate.responseCount,
            participantCount: candidate.participantCount,
            diagnostics,
            datasetVersion: artifact.datasetVersion,
            datasetChecksum: artifact.datasetChecksum,
            calibrationJobId: artifact.calibrationJobId,
            modelImplementationVersion: artifact.modelImplementationVersion,
            elementContentChecksum: checksum({
              id: element.id,
              version: element.version,
              content: element.content,
              options: element.options,
            }),
            treeId: artifact.treeId,
            scaleVersionId: artifact.scaleVersionId,
            assignmentId: assignment.id,
            elementId: element.id,
            elementVersion: element.version,
            createdById: ctx.user.sub,
          },
        })
      )
    }
    return created
  })
}

export async function approveAdaptiveItemCalibration(
  { calibrationId }: { calibrationId: string },
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    await assertAdaptiveReviewer(tx, ctx)
    const calibration = await lockCalibration(tx, calibrationId)
    if (calibration.createdById === ctx.user.sub) {
      throw calibrationServiceError(
        'A calibration creator cannot approve their own calibration.',
        'ADAPTIVE_INDEPENDENT_REVIEW_REQUIRED'
      )
    }
    if (calibration.status !== DB.AdaptiveItemCalibrationStatus.PILOT) {
      throw calibrationServiceError(
        'Only a pilot calibration can be approved.',
        'ADAPTIVE_CALIBRATION_NOT_PILOT'
      )
    }
    if (
      calibration.responseCount < MINIMUM_CALIBRATION_RESPONSES ||
      calibration.participantCount < MINIMUM_CALIBRATION_PARTICIPANTS ||
      calibration.diagnostics.warningCodes.length > 0 ||
      calibration.diagnostics.fitStatus !== 'PASS' ||
      calibration.diagnostics.difStatus !== 'PASS' ||
      calibration.diagnostics.driftStatus !== 'PASS'
    ) {
      throw calibrationServiceError(
        'The calibration does not satisfy the approval policy.',
        'ADAPTIVE_CALIBRATION_POLICY_FAILED'
      )
    }
    return tx.adaptiveItemCalibration.update({
      where: { id: calibration.id },
      data: {
        status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
        approvedById: ctx.user.sub,
        approvedAt: new Date(),
      },
    })
  })
}

function assertCalibrationModel(
  elementType: DB.ElementType,
  options: unknown,
  candidate: AdaptiveCalibrationArtifact['calibrations'][number]
) {
  const twoParameterTypes: DB.ElementType[] = [
    DB.ElementType.NUMERICAL,
    DB.ElementType.FREE_TEXT,
  ]
  const supportedTypes: DB.ElementType[] = [
    DB.ElementType.NUMERICAL,
    DB.ElementType.SC,
    DB.ElementType.MC,
    DB.ElementType.KPRIM,
    DB.ElementType.FREE_TEXT,
  ]
  const expected = twoParameterTypes.includes(elementType)
    ? DB.AdaptiveItemModel.TWO_PL
    : DB.AdaptiveItemModel.THREE_PL_FIXED_C
  if (!supportedTypes.includes(elementType) || candidate.model !== expected) {
    throw calibrationServiceError(
      'The calibration model is incompatible with the element type.',
      'ADAPTIVE_CALIBRATION_MODEL_MISMATCH'
    )
  }
  const choices = (options as { choices?: unknown })?.choices
  const expectedGuessing = deriveGuessingParameter({
    type: elementType as AdaptiveItemType,
    choiceCount: Array.isArray(choices) ? choices.length : null,
  })
  if (candidate.guessing !== expectedGuessing) {
    throw calibrationServiceError(
      'The calibration guessing parameter does not match the element type.',
      'ADAPTIVE_CALIBRATION_GUESSING_MISMATCH'
    )
  }
}
