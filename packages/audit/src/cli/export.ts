import { randomUUID } from 'node:crypto'
import { link, lstat, open, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  AzureTableAuditReader,
  VerifiedAuditEvidence,
} from '../azure/table-reader.js'
import { canonicalizeJson } from '../canonical/canonicalize.js'

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
    evidenceStatus: 'VERIFIED' | 'NO_ROLLOUT_RECORD'
    baselineStatus: 'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'
    coverageStatus:
      | 'COVERED'
      | 'BASELINE_MISSING'
      | 'DURABLE_ROLLOUT_GAP'
      | 'NO_ROLLOUT_RECORD'
    participantStatus: 'NOT_FILTERED' | 'PRESENT' | 'NO_PARTICIPANT_RECORD'
    sealStatus: 'UNSEALED'
    eventCount: number
    participantEventCount: number
    lifecycleEpochs: number[]
    limitations: string[]
  }
  events: VerifiedAuditEvidence['envelope'][]
}

function exportStatuses(
  evidence: VerifiedAuditEvidence[],
  participantId?: string
): AuditExportDocument['verification'] {
  if (evidence.length === 0) {
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
      limitations: ['PRE_INSTRUMENTATION_DELETION_UNKNOWABLE'],
    }
  }
  const eventTypes = new Set(evidence.map(({ envelope }) => envelope.eventType))
  const baselinePresent = eventTypes.has('ASSESSMENT_BASELINE_ROOT_RECORDED')
  const rolloutGap = evidence.some(({ envelope }) => {
    if (envelope.eventType !== 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED') {
      return false
    }
    const payload = envelope.payload as Record<string, unknown>
    return payload.coverageState !== 'COVERED'
  })
  const participantEventCount =
    participantId === undefined
      ? 0
      : evidence.filter(
          ({ envelope }) => envelope.scope.participantId === participantId
        ).length
  return {
    evidenceStatus: 'VERIFIED',
    baselineStatus: baselinePresent ? 'PRESENT' : 'MISSING',
    coverageStatus: rolloutGap
      ? 'DURABLE_ROLLOUT_GAP'
      : baselinePresent
        ? 'COVERED'
        : 'BASELINE_MISSING',
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
    limitations: [],
  }
}

export async function buildAuditExport(input: {
  reader: Pick<AzureTableAuditReader, 'exportQuiz'>
  liveQuizId: string
  lifecycleEpoch?: number
  participantId?: string
  generatedAt?: Date
}): Promise<AuditExportDocument> {
  const evidence = await input.reader.exportQuiz({
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
    verification: exportStatuses(evidence, input.participantId),
    events: evidence.map(({ envelope }) => envelope),
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
