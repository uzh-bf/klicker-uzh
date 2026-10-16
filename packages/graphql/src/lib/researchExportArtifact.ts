import { createHash, randomUUID } from 'node:crypto'
import { GraphQLError } from 'graphql'

import {
  MAX_RESEARCH_EXPORT_BYTES,
  MAX_RESEARCH_EXPORT_RECORDS,
  RESEARCH_EXPORT_DISCLOSURE_VERSION,
  type ResearchExportClass,
} from './researchExportRequest.js'

type ExportIdentifier = string | number

export type ResearchExportResponseCorrectness = 'CORRECT' | 'PARTIAL' | 'WRONG'

export type ResearchExportLiveQuizResponse = {
  participantId: string
  activityId: ExportIdentifier
  elementInstanceId: ExportIdentifier
  response: unknown
  correctness: ResearchExportResponseCorrectness
  points: number
  submittedAt: Date
}

export type ResearchExportAsynchronousResponse = {
  participantId: string
  activityId: ExportIdentifier
  elementInstanceId: ExportIdentifier
  response: unknown
  score: number
  pointsAwarded: number | null
  timeSpent: number
  submittedAt: Date
}

export type BuildResearchExportArtifactInput = {
  exportId: string
  courseId: string
  createdAt: Date
  selectedClasses: ResearchExportClass[]
  liveQuizResponses: ResearchExportLiveQuizResponse[]
  asynchronousResponses: ResearchExportAsynchronousResponse[]
}

type ResearchExportArtifactDocument = {
  manifest: {
    version: typeof RESEARCH_EXPORT_DISCLOSURE_VERSION
    exportId: string
    courseId: string
    createdAt: string
    selectedClasses: ResearchExportClass[]
  }
  LIVE_QUIZ_RESPONSES?: Array<{
    participantKey: string
    activityKey: string
    elementInstanceKey: string
    response: unknown
    correctness: ResearchExportResponseCorrectness
    points: number
    submittedAt: string
  }>
  ASYNCHRONOUS_RESPONSES?: Array<{
    participantKey: string
    activityKey: string
    elementInstanceKey: string
    response: unknown
    score: number
    pointsAwarded: number | null
    timeSpent: number
    submittedAt: string
  }>
}

export type ResearchExportArtifact = {
  body: string
  sha256: string
  byteCount: number
  recordCount: number
}

function exportKey<T extends ExportIdentifier>(
  keys: Map<T, string>,
  identifier: T
) {
  const existingKey = keys.get(identifier)
  if (existingKey !== undefined) return existingKey

  const key = randomUUID()
  keys.set(identifier, key)
  return key
}

function exportError(code: string) {
  return new GraphQLError(code, { extensions: { code } })
}

export function buildResearchExportArtifact({
  exportId,
  courseId,
  createdAt,
  selectedClasses,
  liveQuizResponses,
  asynchronousResponses,
}: BuildResearchExportArtifactInput): ResearchExportArtifact {
  for (const selectedClass of selectedClasses) {
    if (
      selectedClass !== 'LIVE_QUIZ_RESPONSES' &&
      selectedClass !== 'ASYNCHRONOUS_RESPONSES'
    ) {
      throw exportError('DATA_EXPORT_CLASS_UNAVAILABLE')
    }
  }

  if (
    (!selectedClasses.includes('LIVE_QUIZ_RESPONSES') &&
      liveQuizResponses.length > 0) ||
    (!selectedClasses.includes('ASYNCHRONOUS_RESPONSES') &&
      asynchronousResponses.length > 0)
  ) {
    throw exportError('DATA_EXPORT_CLASS_UNAVAILABLE')
  }

  const recordCount =
    (selectedClasses.includes('LIVE_QUIZ_RESPONSES')
      ? liveQuizResponses.length
      : 0) +
    (selectedClasses.includes('ASYNCHRONOUS_RESPONSES')
      ? asynchronousResponses.length
      : 0)

  if (recordCount > MAX_RESEARCH_EXPORT_RECORDS) {
    throw exportError('DATA_EXPORT_TOO_LARGE')
  }

  const participantKeys = new Map<string, string>()
  const activityKeys = new Map<ExportIdentifier, string>()
  const elementInstanceKeys = new Map<ExportIdentifier, string>()

  const document: ResearchExportArtifactDocument = {
    manifest: {
      version: RESEARCH_EXPORT_DISCLOSURE_VERSION,
      exportId,
      courseId,
      createdAt: createdAt.toISOString(),
      selectedClasses,
    },
  }

  if (selectedClasses.includes('LIVE_QUIZ_RESPONSES')) {
    document.LIVE_QUIZ_RESPONSES = liveQuizResponses.map((row) => ({
      participantKey: exportKey(participantKeys, row.participantId),
      activityKey: exportKey(activityKeys, row.activityId),
      elementInstanceKey: exportKey(elementInstanceKeys, row.elementInstanceId),
      response: row.response,
      correctness: row.correctness,
      points: row.points,
      submittedAt: row.submittedAt.toISOString(),
    }))
  }

  if (selectedClasses.includes('ASYNCHRONOUS_RESPONSES')) {
    document.ASYNCHRONOUS_RESPONSES = asynchronousResponses.map((row) => ({
      participantKey: exportKey(participantKeys, row.participantId),
      activityKey: exportKey(activityKeys, row.activityId),
      elementInstanceKey: exportKey(elementInstanceKeys, row.elementInstanceId),
      response: row.response,
      score: row.score,
      pointsAwarded: row.pointsAwarded,
      timeSpent: row.timeSpent,
      submittedAt: row.submittedAt.toISOString(),
    }))
  }

  const body = JSON.stringify(document)
  const byteCount = Buffer.byteLength(body, 'utf8')

  if (byteCount > MAX_RESEARCH_EXPORT_BYTES) {
    throw exportError('DATA_EXPORT_TOO_LARGE')
  }

  return {
    body,
    sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
    byteCount,
    recordCount,
  }
}
