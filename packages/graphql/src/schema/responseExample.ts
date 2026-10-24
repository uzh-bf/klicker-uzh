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
