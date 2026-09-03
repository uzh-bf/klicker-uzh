import { randomUUID } from 'node:crypto'
import { link, lstat, open, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  AzureTableAuditReader,
  VerifiedAuditEvidence,
} from '../azure/table-reader.js'
import {
  type BaselinePartPayload,
  type BaselineRootPayload,
} from '../contract/payloads/coverage.js'
import { canonicalizeJson } from '../canonical/canonicalize.js'
import { hashCanonicalValue } from '../canonical/hash.js'
import {
  aggregateAssessmentBaselineParts,
  assessmentBaselinePartKey,
  compareAssessmentBaselineParts,
} from '../baseline/parts.js'

export type BaselineReconstructionStatus =
  | 'COMPLETE'
  | 'INCOMPLETE'
  | 'CONFLICTED'

export type BaselineReconstruction = {
  baselineId: string
  lifecycleEpoch: number
  status: BaselineReconstructionStatus
  root?: BaselineRootPayload
  partCount: number
  expectedPartCount: number
  issues: string[]
}

export type ExportVerificationFailure = {
  eventId: string
  reason:
    | 'RETENTION_INDEX_MISSING'
    | 'LOCATOR_MISSING'
    | 'EVIDENCE_MISSING'
    | 'VERIFICATION_FAILED'
  detail: string
}

export type AuditExportDocument = {
  format: 'KLICKER_ASSESSMENT_AUDIT_EXPORT'
  formatVersion: 1
  generatedAt: string
  filter: {
    liveQuizId: string
    lifecycleEpoch?: number
    participantId?: string
  }
  verification: {
    evidenceStatus: 'VERIFIED' | 'PARTIAL' | 'NO_ROLLOUT_RECORD'
    baselineStatus:
      | 'PRESENT'
      | 'MISSING'
      | 'INCOMPLETE'
      | 'CONFLICTED'
      | 'NOT_APPLICABLE'
    coverageStatus:
      | 'COVERED'
      | 'BASELINE_MISSING'
      | 'BASELINE_INCOMPLETE'
      | 'BASELINE_CONFLICTED'
      | 'RETENTION_INDEX_MISSING'
      | 'DURABLE_ROLLOUT_GAP'
      | 'NO_ROLLOUT_RECORD'
    participantStatus: 'NOT_FILTERED' | 'PRESENT' | 'NO_PARTICIPANT_RECORD'
    sealStatus: 'UNSEALED'
    eventCount: number
    participantEventCount: number
    lifecycleEpochs: number[]
    baselineReconstructions: BaselineReconstruction[]
    verificationFailures: ExportVerificationFailure[]
    limitations: string[]
  }
  events: VerifiedAuditEvidence['envelope'][]
}

function verifyBaseline(
  root: BaselineRootPayload,
  parts: BaselinePartPayload[],
  baselineId: string,
  lifecycleEpoch: number
): BaselineReconstruction {
  const issues: string[] = []
  const expected = root.expectedPartCounts
  const actual = {
    configuration: 0,
    blocks: 0,
    elementInstances: 0,
    solutionsAndScoring: 0,
    participantEligibility: 0,
    lecturerPermissions: 0,
    mediaReferences: 0,
    limitations: 0,
  }
  const partKeys = new Set<string>()
  for (const part of parts) {
    if (partKeys.has(part.partKey)) {
      issues.push('duplicate part key ' + part.partKey)
    }
    partKeys.add(part.partKey)
    const canonicalKey = assessmentBaselinePartKey(part.content)
    if (canonicalKey !== part.partKey) {
      issues.push(
        'part key ' +
          part.partKey +
          ' is not deterministic for its content (' +
          canonicalKey +
          ')'
      )
    }
    if (hashCanonicalValue(part.content) !== part.contentHash) {
      issues.push('part ' + part.partKey + ' content hash mismatch')
    }
    if (part.baselineId !== baselineId) {
      issues.push('part ' + part.partKey + ' belongs to another baseline')
    }
    if (part.baselineSchemaVersion !== root.baselineSchemaVersion) {
      issues.push('part ' + part.partKey + ' schema version mismatch')
    }
    if (part.capturedAt !== root.capturedAt) {
      issues.push('part ' + part.partKey + ' capturedAt differs from root')
    }
    switch (part.content.kind) {
      case 'ASSESSMENT_CONFIGURATION':
        actual.configuration++
        break
      case 'BLOCK':
        actual.blocks++
        break
      case 'ELEMENT_INSTANCE':
        actual.elementInstances++
        break
      case 'SOLUTION_AND_SCORING':
        actual.solutionsAndScoring++
        break
      case 'PARTICIPANT_ELIGIBILITY':
        actual.participantEligibility++
        break
      case 'LECTURER_PERMISSION':
        actual.lecturerPermissions++
        break
      case 'MEDIA_REFERENCE':
        actual.mediaReferences++
        if (
          part.content.media.contentHash === undefined ||
          part.content.media.blobName !==
            'sha256/' + part.content.media.contentHash
        ) {
          issues.push('part ' + part.partKey + ' media reference is incomplete')
        }
        break
      case 'LIMITATION':
        actual.limitations++
        break
    }
  }

  const expectedCounts = {
    configuration: expected.configuration,
    blocks: expected.blocks,
    elementInstances: expected.elementInstances,
    solutionsAndScoring: expected.solutionsAndScoring,
    participantEligibility: expected.participantEligibility,
    lecturerPermissions: expected.lecturerPermissions,
    mediaReferences: expected.mediaReferences,
    limitations: expected.limitations,
  }
  if (JSON.stringify(actual) !== JSON.stringify(expectedCounts)) {
    issues.push(
      'part counts do not match the root declaration: ' +
        JSON.stringify({ actual, expected: expectedCounts })
    )
  }

  const sortedParts = [...parts].sort(compareAssessmentBaselineParts)
  const recomputed = aggregateAssessmentBaselineParts(sortedParts)
  if (recomputed !== root.aggregateHash) {
    issues.push('aggregate hash does not recompute from the stored parts')
  }

  const expectedPartCount =
    expected.configuration +
    expected.blocks +
    expected.elementInstances +
    expected.solutionsAndScoring +
    expected.participantEligibility +
    expected.lecturerPermissions +
    expected.mediaReferences +
    expected.limitations
  const countMismatch = issues.some((issue) =>
    issue.startsWith('part counts do not match')
  )
  const missingParts = countMismatch && parts.length < expectedPartCount
  const duplicateKeys = issues.some((issue) =>
    issue.startsWith('duplicate part key')
  )
  const status: BaselineReconstructionStatus = issues.length === 0
    ? 'COMPLETE'
    : missingParts && !duplicateKeys
      ? 'INCOMPLETE'
      : 'CONFLICTED'
  return {
    baselineId,
    lifecycleEpoch,
    status,
    root,
    partCount: parts.length,
    expectedPartCount,
    issues,
  }
}

function collectBaselineReconstructions(
  evidence: VerifiedAuditEvidence[]
): BaselineReconstruction[] {
  const groups = new Map<string, BaselineReconstruction>()
  const roots = new Map<string, BaselineRootPayload>()
  const partsByBaseline = new Map<string, BaselinePartPayload[]>()

  for (const { envelope } of evidence) {
    if (envelope.eventType === 'ASSESSMENT_BASELINE_ROOT_RECORDED') {
      const payload = envelope.payload as unknown as BaselineRootPayload
      const key = envelope.scope.lifecycleEpoch + '|' + payload.baselineId
      if (roots.has(key)) {
        groups.set(key, {
          baselineId: payload.baselineId,
          lifecycleEpoch: envelope.scope.lifecycleEpoch,
          status: 'CONFLICTED',
          partCount: 0,
          expectedPartCount: 0,
          issues: ['multiple baseline roots for the same baseline'],
        })
      } else {
        roots.set(key, payload)
      }
    }
    if (envelope.eventType === 'ASSESSMENT_BASELINE_PART_RECORDED') {
      const payload = envelope.payload as unknown as BaselinePartPayload
      const key = envelope.scope.lifecycleEpoch + '|' + payload.baselineId
      const list = partsByBaseline.get(key) ?? []
      list.push(payload)
      partsByBaseline.set(key, list)
    }
  }

  const allKeys = new Set([...roots.keys(), ...partsByBaseline.keys()])
  for (const key of allKeys) {
    const [epoch, baselineId] = key.split('|')
    const numericEpoch = Number(epoch)
    const root = roots.get(key)
    const parts = partsByBaseline.get(key) ?? []
    if (root === undefined) {
      groups.set(key, {
        baselineId,
        lifecycleEpoch: numericEpoch,
        status: 'INCOMPLETE',
        partCount: parts.length,
        expectedPartCount: 0,
        issues: ['baseline root is missing'],
      })
      continue
    }
    groups.set(key, verifyBaseline(root, parts, baselineId, numericEpoch))
  }
  return [...groups.values()].sort(
    (left, right) =>
      left.lifecycleEpoch - right.lifecycleEpoch ||
      left.baselineId.localeCompare(right.baselineId)
  )
}

function exportStatuses(
  evidence: VerifiedAuditEvidence[],
  participantId: string | undefined,
  verificationFailures: ExportVerificationFailure[]
): AuditExportDocument['verification'] {
  if (evidence.length === 0 && verificationFailures.length === 0) {
    return {
      evidenceStatus: 'NO_ROLLOUT_RECORD',
      baselineStatus: 'NOT_APPLICABLE',
      coverageStatus: 'NO_ROLLOUT_RECORD',
      participantStatus:
        participantId === undefined ? 'NOT_FILTERED' : 'NO_PARTICIPANT_RECORD',
      sealStatus: 'UNSEALED',
      eventCount: 0,
      participantEventCount: 0,
      lifecycleEpochs: [],
      baselineReconstructions: [],
      verificationFailures,
      limitations: ['PRE_INSTRUMENTATION_DELETION_UNKNOWABLE'],
    }
  }
  if (evidence.length === 0 && verificationFailures.length > 0) {
    const retentionIndexMissing = verificationFailures.every(
      (failure) => failure.reason === 'RETENTION_INDEX_MISSING'
    )
    return {
      evidenceStatus: 'PARTIAL',
      baselineStatus: 'MISSING',
      coverageStatus: retentionIndexMissing
        ? 'RETENTION_INDEX_MISSING'
        : 'BASELINE_MISSING',
      participantStatus:
        participantId === undefined ? 'NOT_FILTERED' : 'NO_PARTICIPANT_RECORD',
      sealStatus: 'UNSEALED',
      eventCount: 0,
      participantEventCount: 0,
      lifecycleEpochs: [],
      baselineReconstructions: [],
      verificationFailures,
      limitations: ['EVENT_VERIFICATION_FAILED'],
    }
  }
  const reconstructions = collectBaselineReconstructions(evidence)
  const completeBaselines = reconstructions.filter(
    (reconstruction) => reconstruction.status === 'COMPLETE'
  )
  const conflictedBaselines = reconstructions.filter(
    (reconstruction) => reconstruction.status === 'CONFLICTED'
  )
  const incompleteBaselines = reconstructions.filter(
    (reconstruction) => reconstruction.status === 'INCOMPLETE'
  )
  const rolloutGap = evidence.some(({ envelope }) => {
    if (envelope.eventType !== 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED') {
      return false
    }
    const payload = envelope.payload as Record<string, unknown>
    return payload.coverageState !== 'COVERED'
  })
  const activationCovered = evidence.some(({ envelope }) => {
    if (
      envelope.eventType !== 'ASSESSMENT_AUDIT_ACTIVATED' &&
      envelope.eventType !== 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED'
    ) {
      return false
    }
    const payload = envelope.payload as Record<string, unknown>
    return payload.coverageState === 'COVERED'
  })
  const participantEventCount =
    participantId === undefined
      ? 0
      : evidence.filter(
          ({ envelope }) => envelope.scope.participantId === participantId
        ).length
  const hasBaselineEvidence = reconstructions.length > 0
  const hasCompleteBaseline = completeBaselines.length > 0
  const hasAnyBaselineIssue =
    conflictedBaselines.length > 0 || incompleteBaselines.length > 0
  const retentionIndexMissing = verificationFailures.some(
    (failure) => failure.reason === 'RETENTION_INDEX_MISSING'
  )

  let baselineStatus: AuditExportDocument['verification']['baselineStatus']
  let coverageStatus: AuditExportDocument['verification']['coverageStatus']
  if (retentionIndexMissing) {
    baselineStatus = hasBaselineEvidence ? 'INCOMPLETE' : 'MISSING'
    coverageStatus = 'RETENTION_INDEX_MISSING'
  } else if (!hasBaselineEvidence) {
    baselineStatus = 'MISSING'
    coverageStatus = rolloutGap
      ? 'DURABLE_ROLLOUT_GAP'
      : 'BASELINE_MISSING'
  } else if (incompleteBaselines.length > 0) {
    baselineStatus = 'INCOMPLETE'
    coverageStatus = rolloutGap
      ? 'DURABLE_ROLLOUT_GAP'
      : 'BASELINE_INCOMPLETE'
  } else if (conflictedBaselines.length > 0) {
    baselineStatus = 'CONFLICTED'
    coverageStatus = rolloutGap
      ? 'DURABLE_ROLLOUT_GAP'
      : 'BASELINE_CONFLICTED'
  } else if (hasCompleteBaseline) {
    baselineStatus = 'PRESENT'
    coverageStatus = rolloutGap
      ? 'DURABLE_ROLLOUT_GAP'
      : activationCovered
        ? 'COVERED'
        : 'BASELINE_MISSING'
  } else {
    baselineStatus = 'MISSING'
    coverageStatus = 'BASELINE_MISSING'
  }

  const limitations: string[] = []
  if (rolloutGap) {
    limitations.push('ROLLOUT_GAP_RECORDED')
  }
  if (!activationCovered && hasCompleteBaseline) {
    limitations.push('ACTIVATION_EVIDENCE_MISSING')
  }
  if (hasAnyBaselineIssue) {
    limitations.push('BASELINE_RECONSTRUCTION_ISSUES')
  }

  return {
    evidenceStatus: verificationFailures.length > 0 ? 'PARTIAL' : 'VERIFIED',
    baselineStatus,
    coverageStatus,
    participantStatus:
      participantId === undefined
        ? 'NOT_FILTERED'
        : participantEventCount > 0
          ? 'PRESENT'
          : 'NO_PARTICIPANT_RECORD',
    sealStatus: 'UNSEALED',
    eventCount: evidence.length,
    participantEventCount,
    lifecycleEpochs: [
      ...new Set(evidence.map(({ envelope }) => envelope.scope.lifecycleEpoch)),
    ].sort((left, right) => left - right),
    baselineReconstructions: reconstructions,
    verificationFailures,
    limitations,
  }
}

export async function buildAuditExport(input: {
  reader: Pick<AzureTableAuditReader, 'exportQuizWithFailures'>
  liveQuizId: string
  lifecycleEpoch?: number
  participantId?: string
  generatedAt?: Date
}): Promise<AuditExportDocument> {
  const { verified, failures } = await input.reader.exportQuizWithFailures({
    liveQuizId: input.liveQuizId,
    lifecycleEpoch: input.lifecycleEpoch,
    participantId: input.participantId,
  })
  return {
    format: 'KLICKER_ASSESSMENT_AUDIT_EXPORT',
    formatVersion: 1,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    filter: {
      liveQuizId: input.liveQuizId,
      ...(input.lifecycleEpoch === undefined
        ? {}
        : { lifecycleEpoch: input.lifecycleEpoch }),
      ...(input.participantId === undefined
        ? {}
        : { participantId: input.participantId }),
    },
    verification: exportStatuses(verified, input.participantId, failures),
    events: verified.map(({ envelope }) => envelope),
  }
}

async function syncDirectory(path: string): Promise<void> {
  const directory = await open(path, 'r')
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

export async function writePrivateAtomicFile(input: {
  outputPath: string
  content: string
  force?: boolean
}): Promise<string> {
  const destination = resolve(input.outputPath)
  const destinationDirectory = dirname(destination)
  if (!input.force) {
    try {
      await lstat(destination)
      throw new Error(
        `Refusing to overwrite existing audit export: ${destination}`
      )
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      ) {
        throw error
      }
    }
  }

  const temporary = `${destination}.tmp-${randomUUID()}`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(input.content, { encoding: 'utf8' })
    await handle.sync()
  } catch (error) {
    await handle.close()
    await unlink(temporary).catch(() => undefined)
    throw error
  }
  await handle.close()

  try {
    if (input.force) {
      await rename(temporary, destination)
    } else {
      await link(temporary, destination)
      await unlink(temporary)
    }
    await syncDirectory(destinationDirectory)
    return destination
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

export function serializeAuditExport(document: AuditExportDocument): string {
  return `${canonicalizeJson(document)}\n`
}
