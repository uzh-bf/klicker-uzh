import { createHash } from 'node:crypto'

export interface ResponseExampleEvidenceDigestInput {
  id: string
  responseExampleId: string
  citationIndex: number
  sourceId: string
  chunkId: string
  contentHash: string
  citationAnchor: string
  evidenceEligible: boolean
}

export interface ResponseExampleDigestInput {
  id: string
  setId: string
  chatMode: string
  studentMessage: string
  referenceAnswer: string
  responseStyle: string
  status: string
  evidenceReferences: readonly ResponseExampleEvidenceDigestInput[]
}

export interface ResponseExampleSetDigestInput {
  id: string
  chatbotId: string
  examples: readonly ResponseExampleDigestInput[]
}

function compareStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareFields<T extends object>(
  left: T,
  right: T,
  fields: readonly (keyof T)[]
) {
  for (const field of fields) {
    const comparison = compareStrings(String(left[field]), String(right[field]))
    if (comparison !== 0) return comparison
  }
  return 0
}

export function computeResponseExampleSetDigest(
  set: ResponseExampleSetDigestInput
) {
  const canonical = {
    setId: set.id,
    chatbotId: set.chatbotId,
    examples: [...set.examples]
      .sort((left, right) =>
        compareFields(left, right, [
          'chatMode',
          'studentMessage',
          'referenceAnswer',
          'responseStyle',
          'status',
          'id',
          'setId',
        ])
      )
      .map((example) => ({
        id: example.id,
        setId: example.setId,
        chatMode: example.chatMode,
        studentMessage: example.studentMessage,
        referenceAnswer: example.referenceAnswer,
        responseStyle: example.responseStyle,
        status: example.status,
        evidenceReferences: [...example.evidenceReferences]
          .sort((left, right) =>
            compareFields(left, right, [
              'citationIndex',
              'sourceId',
              'chunkId',
              'contentHash',
              'citationAnchor',
              'id',
              'responseExampleId',
            ])
          )
          .map((reference) => ({
            id: reference.id,
            responseExampleId: reference.responseExampleId,
            citationIndex: reference.citationIndex,
            sourceId: reference.sourceId,
            chunkId: reference.chunkId,
            contentHash: reference.contentHash,
            citationAnchor: reference.citationAnchor,
            evidenceEligible: reference.evidenceEligible,
          })),
      })),
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
