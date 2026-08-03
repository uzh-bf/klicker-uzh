import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type { CompetenceTreeScaleLevelInput as CompetenceTreeScaleLevelInputType } from '../services/competenceTreeCalibration.js'
import type { AdaptiveCalibrationExportRequestView } from '../services/competenceTreeCalibrationExport.js'
import type {
  AdaptiveEmpiricalValidationOverview,
  AdaptiveItemCalibrationOverview,
  CompetenceTreeCalibrationOverview,
  CompetenceTreeCalibrationReadinessOverview,
  CompetenceTreeScaleApprovalOverview,
  CompetenceTreeScaleLevelOverview,
  CompetenceTreeScaleLinkOverview,
  CompetenceTreeScaleOverview,
} from '../services/competenceTreeCalibrationReadModels.js'

export const CompetenceTreeCalibrationReadinessStatus = builder.enumType(
  'CompetenceTreeCalibrationReadinessStatus',
  {
    values: [
      'NO_ACTIVE_SCALE',
      'CALIBRATION_INCOMPLETE',
      'CALIBRATED_BANK',
    ] as const,
  }
)

export const AdaptiveScaleVersionStatus = builder.enumType(
  'AdaptiveScaleVersionStatus',
  { values: Object.values(DB.AdaptiveScaleVersionStatus) }
)
export const AdaptiveScaleLinkStatus = builder.enumType(
  'AdaptiveScaleLinkStatus',
  { values: Object.values(DB.AdaptiveScaleLinkStatus) }
)
export const AdaptiveItemCalibrationStatus = builder.enumType(
  'AdaptiveItemCalibrationStatus',
  { values: Object.values(DB.AdaptiveItemCalibrationStatus) }
)
export const AdaptiveItemModel = builder.enumType('AdaptiveItemModel', {
  values: Object.values(DB.AdaptiveItemModel),
})
export const AdaptiveEmpiricalValidationStatus = builder.enumType(
  'AdaptiveEmpiricalValidationStatus',
  { values: Object.values(DB.AdaptiveEmpiricalValidationStatus) }
)
export const AdaptiveMeasurementVersion = builder.enumType(
  'AdaptiveMeasurementVersion',
  { values: Object.values(DB.AdaptiveMeasurementVersion) }
)
export const AdaptiveCalibrationExportStatus = builder.enumType(
  'AdaptiveCalibrationExportStatus',
  { values: Object.values(DB.AdaptiveCalibrationExportStatus) }
)
export const AdaptiveReviewDecision = builder.enumType(
  'AdaptiveReviewDecision',
  { values: ['APPROVED', 'REJECTED'] as const }
)

export const CompetenceTreeScaleLevelInputRef =
  builder.inputRef<CompetenceTreeScaleLevelInputType>(
    'CompetenceTreeScaleLevelInput'
  )
export const CompetenceTreeScaleLevelInput =
  CompetenceTreeScaleLevelInputRef.implement({
    fields: (t) => ({
      sourceLevelId: t.int({ required: true }),
      lowerBound: t.float({ required: false }),
      itemDifficultyPrior: t.float({ required: true }),
    }),
  })

const AdaptiveCalibrationCountsRef = builder.objectRef<
  CompetenceTreeScaleOverview['calibrationCounts']
>('AdaptiveCalibrationCounts')
AdaptiveCalibrationCountsRef.implement({
  fields: (t) => ({
    provisional: t.exposeInt('PROVISIONAL'),
    pilot: t.exposeInt('PILOT'),
    calibrated: t.exposeInt('CALIBRATED'),
    flagged: t.exposeInt('FLAGGED'),
    retired: t.exposeInt('RETIRED'),
  }),
})

const CompetenceTreeCalibrationReadinessRef =
  builder.objectRef<CompetenceTreeCalibrationReadinessOverview>(
    'CompetenceTreeCalibrationReadiness'
  )
CompetenceTreeCalibrationReadinessRef.implement({
  fields: (t) => ({
    status: t.expose('status', {
      type: CompetenceTreeCalibrationReadinessStatus,
    }),
    activeScaleVersion: t.exposeInt('activeScaleVersion', { nullable: true }),
    enabledAssignmentCount: t.exposeInt('enabledAssignmentCount'),
    calibratedAssignmentCount: t.exposeInt('calibratedAssignmentCount'),
    blockingAssignmentCount: t.exposeInt('blockingAssignmentCount'),
    detailsRedacted: t.exposeBoolean('detailsRedacted'),
  }),
})

const CompetenceTreeScaleLevelRef =
  builder.objectRef<CompetenceTreeScaleLevelOverview>(
    'CompetenceTreeScaleLevel'
  )
CompetenceTreeScaleLevelRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    order: t.exposeInt('order'),
    label: t.exposeString('label'),
    lowerBound: t.exposeFloat('lowerBound', { nullable: true }),
    itemDifficultyPrior: t.exposeFloat('itemDifficultyPrior'),
    sourceLevelId: t.exposeInt('sourceLevelId', { nullable: true }),
  }),
})

const CompetenceTreeScaleApprovalRef =
  builder.objectRef<CompetenceTreeScaleApprovalOverview>(
    'CompetenceTreeScaleApproval'
  )
CompetenceTreeScaleApprovalRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    method: t.exposeString('method'),
    methodVersion: t.exposeString('methodVersion'),
    panelSize: t.exposeInt('panelSize'),
    standardSettingDate: t.expose('standardSettingDate', { type: 'Date' }),
    cutRationale: t.expose('cutRationale', { type: 'Json' }),
    decision: t.expose('decision', {
      type: AdaptiveScaleVersionStatus,
      nullable: true,
    }),
    reviewedAt: t.expose('reviewedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

const CompetenceTreeScaleLinkRef =
  builder.objectRef<CompetenceTreeScaleLinkOverview>('CompetenceTreeScaleLink')
CompetenceTreeScaleLinkRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    status: t.expose('status', { type: AdaptiveScaleLinkStatus }),
    fromScaleVersionId: t.exposeString('fromScaleVersionId'),
    toScaleVersionId: t.exposeString('toScaleVersionId'),
    method: t.exposeString('method'),
    implementationVersion: t.exposeString('implementationVersion'),
    reviewedAt: t.expose('reviewedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

const AdaptiveItemCalibrationRef =
  builder.objectRef<AdaptiveItemCalibrationOverview>('AdaptiveItemCalibration')
AdaptiveItemCalibrationRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    assignmentId: t.exposeInt('assignmentId'),
    elementId: t.exposeInt('elementId'),
    elementVersion: t.exposeInt('elementVersion'),
    version: t.exposeInt('version'),
    model: t.expose('model', { type: AdaptiveItemModel }),
    status: t.expose('status', { type: AdaptiveItemCalibrationStatus }),
    discrimination: t.exposeFloat('discrimination'),
    difficulty: t.exposeFloat('difficulty'),
    guessing: t.exposeFloat('guessing'),
    parameterUncertainty: t.expose('parameterUncertainty', { type: 'Json' }),
    responseCount: t.exposeInt('responseCount'),
    participantCount: t.exposeInt('participantCount'),
    diagnostics: t.expose('diagnostics', { type: 'Json' }),
    modelImplementationVersion: t.exposeString('modelImplementationVersion'),
    approvedAt: t.expose('approvedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

const AdaptiveEmpiricalValidationRef =
  builder.objectRef<AdaptiveEmpiricalValidationOverview>(
    'AdaptiveEmpiricalValidation'
  )
AdaptiveEmpiricalValidationRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    configId: t.exposeString('configId'),
    status: t.expose('status', { type: AdaptiveEmpiricalValidationStatus }),
    measurementVersion: t.expose('measurementVersion', {
      type: AdaptiveMeasurementVersion,
    }),
    estimatorImplementationVersion: t.exposeString(
      'estimatorImplementationVersion'
    ),
    classificationPolicyVersion: t.exposeInt('classificationPolicyVersion'),
    calibrationPolicyVersion: t.exposeInt('calibrationPolicyVersion'),
    approvedProbabilityThreshold: t.exposeFloat('approvedProbabilityThreshold'),
    aggregateMetrics: t.expose('aggregateMetrics', { type: 'Json' }),
    stratumMetrics: t.expose('stratumMetrics', { type: 'Json' }),
    submittedAt: t.expose('submittedAt', { type: 'Date' }),
    reviewedAt: t.expose('reviewedAt', { type: 'Date', nullable: true }),
  }),
})

const CompetenceTreeScaleRef = builder.objectRef<CompetenceTreeScaleOverview>(
  'CompetenceTreeScale'
)
CompetenceTreeScaleRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    version: t.exposeInt('version'),
    status: t.expose('status', { type: AdaptiveScaleVersionStatus }),
    supersedesVersionId: t.exposeString('supersedesVersionId', {
      nullable: true,
    }),
    priorMean: t.exposeFloat('priorMean'),
    priorStandardDeviation: t.exposeFloat('priorStandardDeviation'),
    gridMin: t.exposeFloat('gridMin'),
    gridMax: t.exposeFloat('gridMax'),
    gridStep: t.exposeFloat('gridStep'),
    classificationPolicyVersion: t.exposeInt('classificationPolicyVersion'),
    submittedForReviewAt: t.expose('submittedForReviewAt', {
      type: 'Date',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    levels: t.expose('levels', { type: [CompetenceTreeScaleLevelRef] }),
    approvals: t.expose('approvals', {
      type: [CompetenceTreeScaleApprovalRef],
    }),
    scaleLinks: t.expose('scaleLinks', { type: [CompetenceTreeScaleLinkRef] }),
    empiricalValidations: t.expose('empiricalValidations', {
      type: [AdaptiveEmpiricalValidationRef],
    }),
    calibrationCounts: t.expose('calibrationCounts', {
      type: AdaptiveCalibrationCountsRef,
    }),
    calibrations: t.expose('calibrations', {
      type: [AdaptiveItemCalibrationRef],
    }),
  }),
})

export const CompetenceTreeCalibrationRef =
  builder.objectRef<CompetenceTreeCalibrationOverview>(
    'CompetenceTreeCalibration'
  )
CompetenceTreeCalibrationRef.implement({
  fields: (t) => ({
    treeId: t.exposeString('treeId'),
    treeName: t.exposeString('treeName'),
    canManage: t.exposeBoolean('canManage'),
    readiness: t.expose('readiness', {
      type: CompetenceTreeCalibrationReadinessRef,
    }),
    scales: t.expose('scales', { type: [CompetenceTreeScaleRef] }),
  }),
})

export type AdaptiveWorkflowReceipt = {
  id: string
  status: string
}
export const AdaptiveWorkflowReceiptRef =
  builder.objectRef<AdaptiveWorkflowReceipt>('AdaptiveWorkflowReceipt')
AdaptiveWorkflowReceiptRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    status: t.exposeString('status'),
  }),
})

export type AdaptiveCalibrationImportReceipt = {
  calibrationIds: string[]
  importedCount: number
}
export const AdaptiveCalibrationImportReceiptRef =
  builder.objectRef<AdaptiveCalibrationImportReceipt>(
    'AdaptiveCalibrationImportReceipt'
  )
AdaptiveCalibrationImportReceiptRef.implement({
  fields: (t) => ({
    calibrationIds: t.exposeStringList('calibrationIds'),
    importedCount: t.exposeInt('importedCount'),
  }),
})

export const AdaptiveCalibrationExportRequestRef =
  builder.objectRef<AdaptiveCalibrationExportRequestView>(
    'AdaptiveCalibrationExportRequest'
  )
AdaptiveCalibrationExportRequestRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    treeId: t.exposeString('treeId'),
    scaleVersionId: t.exposeString('scaleVersionId'),
    datasetVersion: t.exposeString('datasetVersion'),
    splitPolicyVersion: t.exposeString('splitPolicyVersion'),
    status: t.expose('status', { type: AdaptiveCalibrationExportStatus }),
    artifactChecksum: t.exposeString('artifactChecksum', { nullable: true }),
    rowCount: t.exposeInt('rowCount', { nullable: true }),
    failureCode: t.exposeString('failureCode', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
    expiresAt: t.expose('expiresAt', { type: 'Date' }),
    downloadUrl: t.exposeString('downloadUrl', { nullable: true }),
  }),
})
