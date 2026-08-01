import * as DB from '@klicker-uzh/prisma/client'
import { createHmac } from 'node:crypto'

const EXPORT_SCHEMA_VERSION = 1
const MAX_EXPORTED_ELAPSED_SECONDS = 3_600
export type AdaptiveCalibrationExportSplit = 'CALIBRATION' | 'HOLDOUT'

export type AdaptiveCalibrationExportSourceRow = {
  responseId: number
  subjectKey: string
  cohortKey: string
  publicationVersion: number
  measurementVersion: DB.AdaptiveMeasurementVersion
  estimatorImplementationVersion: string
  classificationPolicyVersion: number
  calibrationPolicyVersion: number
  assignmentId: number
  elementId: number
  elementVersion: number
  elementType: DB.ElementType
  calibrationId: string
  calibrationVersion: number
  calibrationStatus: DB.AdaptiveItemCalibrationStatus
  itemModel: DB.AdaptiveItemModel
  itemRole: DB.AdaptivePoolItemRole
  score: number
  correct: boolean
  responseCategory: unknown
  elapsedSeconds: number | null
  administrationProbability: number
  collectionDesignVersion: string
  isCalibrationAnchor: boolean
}

export type AdaptiveCalibrationExportRow = {
  schemaVersion: 1
  subjectPseudonym: string
  cohortPseudonym: string
  publicationVersion: number
  measurementVersion: DB.AdaptiveMeasurementVersion
  estimatorImplementationVersion: string
  classificationPolicyVersion: number
  calibrationPolicyVersion: number
  assignmentId: number
  elementId: number
  elementVersion: number
  elementType: DB.ElementType
  calibrationId: string
  calibrationVersion: number
  calibrationStatus: DB.AdaptiveItemCalibrationStatus
  itemModel: DB.AdaptiveItemModel
  itemRole: DB.AdaptivePoolItemRole
  score: number
  correct: boolean
  responseCategory: number[] | null
  elapsedSeconds: number | null
  administrationProbability: number
  collectionDesignVersion: string
  isCalibrationAnchor: boolean
}

export function deriveAdaptiveExportPseudonym({
  hmacKey,
  domain,
  treeId,
  datasetVersion,
  sourceId,
}: {
  hmacKey: string
  domain: 'subject' | 'cohort'
  treeId: string
  datasetVersion: string
  sourceId: string
}) {
  return createHmac('sha256', hmacKey)
    .update(`${domain}\0${treeId}\0${datasetVersion}\0${sourceId}`, 'utf8')
    .digest('hex')
}

export function assignAdaptiveExportSplit({
  hmacKey,
  treeId,
  datasetVersion,
  subjectKey,
}: {
  hmacKey: string
  treeId: string
  datasetVersion: string
  subjectKey: string
}): AdaptiveCalibrationExportSplit {
  const digest = createHmac('sha256', hmacKey)
    .update(`split\0${treeId}\0${datasetVersion}\0${subjectKey}`, 'utf8')
    .digest()
  return digest.readUInt32BE(0) % 100 < 20 ? 'HOLDOUT' : 'CALIBRATION'
}

export function projectAdaptiveCalibrationExportRow({
  row,
  treeId,
  datasetVersion,
  hmacKey,
}: {
  row: AdaptiveCalibrationExportSourceRow
  treeId: string
  datasetVersion: string
  hmacKey: string
}): AdaptiveCalibrationExportRow {
  if (
    !Number.isFinite(row.score) ||
    !Number.isFinite(row.administrationProbability) ||
    row.administrationProbability <= 0 ||
    row.administrationProbability > 1
  ) {
    throw new Error('ADAPTIVE_EXPORT_INVALID_SOURCE_ROW')
  }
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    subjectPseudonym: deriveAdaptiveExportPseudonym({
      hmacKey,
      domain: 'subject',
      treeId,
      datasetVersion,
      sourceId: row.subjectKey,
    }),
    cohortPseudonym: deriveAdaptiveExportPseudonym({
      hmacKey,
      domain: 'cohort',
      treeId,
      datasetVersion,
      sourceId: row.cohortKey,
    }),
    publicationVersion: row.publicationVersion,
    measurementVersion: row.measurementVersion,
    estimatorImplementationVersion: row.estimatorImplementationVersion,
    classificationPolicyVersion: row.classificationPolicyVersion,
    calibrationPolicyVersion: row.calibrationPolicyVersion,
    assignmentId: row.assignmentId,
    elementId: row.elementId,
    elementVersion: row.elementVersion,
    elementType: row.elementType,
    calibrationId: row.calibrationId,
    calibrationVersion: row.calibrationVersion,
    calibrationStatus: row.calibrationStatus,
    itemModel: row.itemModel,
    itemRole: row.itemRole,
    score: row.score,
    correct: row.correct,
    responseCategory: choiceCategory(row),
    elapsedSeconds:
      row.elapsedSeconds === null
        ? null
        : Math.min(
            Math.max(Math.trunc(row.elapsedSeconds), 0),
            MAX_EXPORTED_ELAPSED_SECONDS
          ),
    administrationProbability: row.administrationProbability,
    collectionDesignVersion: row.collectionDesignVersion,
    isCalibrationAnchor: row.isCalibrationAnchor,
  }
}

function choiceCategory(row: AdaptiveCalibrationExportSourceRow) {
  if (
    row.elementType !== DB.ElementType.SC &&
    row.elementType !== DB.ElementType.MC &&
    row.elementType !== DB.ElementType.KPRIM
  ) {
    if (row.responseCategory !== null) {
      throw new Error('ADAPTIVE_EXPORT_INVALID_RESPONSE_CATEGORY')
    }
    return null
  }
  if (
    !Array.isArray(row.responseCategory) ||
    !row.responseCategory.every(
      (entry) => Number.isInteger(entry) && entry >= 0
    )
  ) {
    throw new Error('ADAPTIVE_EXPORT_INVALID_RESPONSE_CATEGORY')
  }
  return row.responseCategory as number[]
}
