import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import {
  hasCompleteEligibleCitationParity,
  responseExampleActions,
} from '../lib/responseExampleContract.js'

export const ResponseExampleStatus = builder.enumType('ResponseExampleStatus', {
  values: Object.values(DB.ResponseExampleStatus),
})

export const ResponseExampleStyle = builder.enumType('ResponseExampleStyle', {
  values: Object.values(DB.ResponseExampleStyle),
})

type ResponseExampleEvidenceReferenceData = DB.ResponseExampleEvidenceReference

type ResponseExampleData = DB.ResponseExample & {
  evidenceReferences: ResponseExampleEvidenceReferenceData[]
}

type ResponseExampleSetData = DB.ResponseExampleSet & {
  examples: ResponseExampleData[]
  chatModes: string[]
}

export interface CaptureResponseExampleResultData {
  exampleId: string
  created: boolean
}

export const ResponseExampleEvidenceReferenceRef =
  builder.objectRef<ResponseExampleEvidenceReferenceData>(
    'ResponseExampleEvidenceReference'
  )
export const ResponseExampleEvidenceReference =
  ResponseExampleEvidenceReferenceRef.implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      responseExampleId: t.exposeID('responseExampleId'),
      sourceId: t.exposeString('sourceId'),
      chunkId: t.exposeString('chunkId'),
      contentHash: t.exposeString('contentHash'),
      citationIndex: t.exposeInt('citationIndex'),
      citationAnchor: t.exposeString('citationAnchor'),
      evidenceEligible: t.exposeBoolean('evidenceEligible'),
      createdAt: t.expose('createdAt', { type: 'Date' }),
    }),
  })

export const ResponseExampleRef =
  builder.objectRef<ResponseExampleData>('ResponseExample')
export const ResponseExample = ResponseExampleRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    setId: t.exposeID('setId'),
    chatMode: t.exposeString('chatMode'),
    studentMessage: t.exposeString('studentMessage'),
    referenceAnswer: t.exposeString('referenceAnswer'),
    responseStyle: t.expose('responseStyle', { type: ResponseExampleStyle }),
    status: t.expose('status', { type: ResponseExampleStatus }),
    canApprove: t.boolean({
      resolve: (example) => responseExampleActions(example.status).canApprove,
    }),
    canEditAndApprove: t.boolean({
      resolve: (example) =>
        responseExampleActions(example.status).canEditAndApprove,
    }),
    canReject: t.boolean({
      resolve: (example) => responseExampleActions(example.status).canReject,
    }),
    hasCompleteEligibleCitationParity: t.boolean({
      resolve: (example) =>
        hasCompleteEligibleCitationParity(
          example.referenceAnswer,
          example.evidenceReferences
        ),
    }),
    reviewedById: t.exposeID('reviewedById', { nullable: true }),
    reviewedAt: t.expose('reviewedAt', {
      type: 'Date',
      nullable: true,
    }),
    evidenceReferences: t.field({
      type: [ResponseExampleEvidenceReference],
      resolve: (example) => example.evidenceReferences,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const ResponseExampleSetRef =
  builder.objectRef<ResponseExampleSetData>('ResponseExampleSet')
export const ResponseExampleSet = ResponseExampleSetRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    chatbotId: t.exposeID('chatbotId'),
    digest: t.exposeString('digest'),
    chatModes: t.exposeStringList('chatModes'),
    examples: t.field({
      type: [ResponseExample],
      resolve: (set) => set.examples,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const CaptureResponseExampleResultRef =
  builder.objectRef<CaptureResponseExampleResultData>(
    'CaptureResponseExampleResult'
  )
export const CaptureResponseExampleResult =
  CaptureResponseExampleResultRef.implement({
    fields: (t) => ({
      exampleId: t.exposeID('exampleId'),
      created: t.exposeBoolean('created'),
    }),
  })

export const BaselineCaseStatus = builder.enumType('BaselineCaseStatus', {
  values: Object.values(DB.BaselineCaseStatus),
})
export const BaselineReportStatus = builder.enumType('BaselineReportStatus', {
  values: Object.values(DB.BaselineReportStatus),
})
export const ResponseExampleBaselineCase = builder
  .objectRef<DB.ResponseExampleBaselineCase>('ResponseExampleBaselineCase')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      exampleId: t.exposeID('exampleId'),
      chatMode: t.exposeString('chatMode'),
      question: t.exposeString('question'),
      idealAnswer: t.exposeString('idealAnswer'),
      expectedEvidence: t.expose('expectedEvidence', { type: 'Json' }),
      status: t.expose('status', { type: BaselineCaseStatus }),
      actualAnswer: t.exposeString('actualAnswer', { nullable: true }),
      actualEvidence: t.expose('actualEvidence', {
        type: 'Json',
        nullable: true,
      }),
      assessment: t.expose('assessment', { type: 'Json', nullable: true }),
      errorCode: t.exposeString('errorCode', { nullable: true }),
    }),
  })
export type ResponseExampleBaselineReportData =
  DB.ResponseExampleBaselineReport & {
    stale: boolean
    cases: DB.ResponseExampleBaselineCase[]
  }
export const ResponseExampleBaselineReport = builder
  .objectRef<ResponseExampleBaselineReportData>('ResponseExampleBaselineReport')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      status: t.expose('status', { type: BaselineReportStatus }),
      stale: t.exposeBoolean('stale'),
      excludedCount: t.exposeInt('excludedCount'),
      errorCode: t.exposeString('errorCode', { nullable: true }),
      modelId: t.exposeString('modelId', { nullable: true }),
      createdAt: t.expose('createdAt', { type: 'Date' }),
      updatedAt: t.expose('updatedAt', { type: 'Date' }),
      cases: t.field({
        type: [ResponseExampleBaselineCase],
        resolve: (report) => report.cases,
      }),
    }),
  })
export const ResponseExampleBaselineOverview = builder
  .objectRef<{
    eligibleCount: number
    excludedCount: number
    available: boolean
    report: ResponseExampleBaselineReportData | null
  }>('ResponseExampleBaselineOverview')
  .implement({
    fields: (t) => ({
      eligibleCount: t.exposeInt('eligibleCount'),
      excludedCount: t.exposeInt('excludedCount'),
      available: t.exposeBoolean('available'),
      report: t.field({
        type: ResponseExampleBaselineReport,
        nullable: true,
        resolve: (overview) => overview.report,
      }),
    }),
  })
