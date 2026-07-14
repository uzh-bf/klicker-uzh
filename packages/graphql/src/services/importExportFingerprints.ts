import * as DB from '@klicker-uzh/prisma/client'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  type FingerprintMediaContext,
} from '../lib/importExportFingerprintCanonicalization.js'
import {
  computeAnswerCollectionDidacticFingerprintFromDbV1,
  computeElementDidacticFingerprintFromDbV1,
  type FingerprintPrisma,
  refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprintV1,
} from './importExportFingerprintPersistence.js'

type JsonRecord = Record<string, unknown>

export type FingerprintAnswerCollectionPayload = {
  // Retained for compatibility with existing callers; metadata/history are not
  // part of version-1 didactic identity.
  name?: string
  description?: string
  version?: number | null
  entries: readonly { value: string }[]
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}

export type FingerprintElementPayload = {
  // Retained for compatibility with existing callers; names and workflow state
  // are intentionally excluded from version-1 didactic identity.
  name?: string
  content: string
  type: DB.ElementType
  options: JsonRecord
  pointsMultiplier: number
  basePoints: boolean
  explanation?: string | null
  status?: DB.ElementStatus
  answerCollection?: FingerprintAnswerCollectionPayload | null
  selectedAnswerCollectionValues?: readonly string[] | null
  entryValueById?: ReadonlyMap<number, string>
  entryValueByRef?: ReadonlyMap<string, string>
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}

const IMPORT_MEDIA_IDENTITY_PATTERN = /^import-media:([a-f0-9]{64})$/

function toMediaContext(
  identityByUrl: ReadonlyMap<string, string> | undefined
): FingerprintMediaContext | undefined {
  if (!identityByUrl || identityByUrl.size === 0) return undefined

  const verifiedByHref = new Map<string, { sha256: string }>()
  const unresolvedHrefs = new Set<string>()

  for (const [href, identity] of identityByUrl) {
    const match = IMPORT_MEDIA_IDENTITY_PATTERN.exec(identity)
    if (match?.[1]) {
      verifiedByHref.set(href, { sha256: match[1] })
    } else {
      unresolvedHrefs.add(href)
    }
  }

  return { verifiedByHref, unresolvedHrefs }
}

export function computeAnswerCollectionImportFingerprint(
  collection: FingerprintAnswerCollectionPayload
) {
  return (
    computeAnswerCollectionDidacticFingerprint({
      entries: collection.entries,
    })?.fingerprint ?? null
  )
}

export function computeElementImportFingerprint(
  element: FingerprintElementPayload
) {
  return (
    computeElementDidacticFingerprint({
      type: element.type,
      content: element.content,
      explanation: element.explanation,
      options: element.options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      answerPoolValues: element.answerCollection?.entries.map(
        (entry) => entry.value
      ),
      selectedAnswerValues: element.selectedAnswerCollectionValues,
      relationValueById: element.entryValueById,
      relationValueByRef: element.entryValueByRef,
      media: toMediaContext(element.mediaIdentityByUrl),
    })?.fingerprint ?? null
  )
}

export async function computeElementImportFingerprintFromDb(
  elementId: number,
  prisma: FingerprintPrisma
) {
  const snapshot = await computeElementDidacticFingerprintFromDbV1(
    elementId,
    prisma
  )
  return snapshot?.computed?.fingerprint ?? null
}

export async function refreshElementImportFingerprint(
  elementId: number,
  prisma: FingerprintPrisma
) {
  const result = await refreshElementDidacticFingerprintV1(elementId, prisma)
  return result.computed?.fingerprint ?? null
}

export async function computeAnswerCollectionImportFingerprintFromDb(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  const snapshot = await computeAnswerCollectionDidacticFingerprintFromDbV1(
    answerCollectionId,
    prisma
  )
  return snapshot?.computed?.fingerprint ?? null
}

export async function refreshAnswerCollectionImportFingerprint(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  const result = await refreshAnswerCollectionDidacticFingerprintV1(
    answerCollectionId,
    prisma
  )
  return result.computed?.fingerprint ?? null
}
