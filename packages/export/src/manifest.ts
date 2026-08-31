import { createHash } from 'node:crypto'
import { chmodSync, createReadStream, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'

import type { PiiMode } from './pii.js'

export const MANIFEST_SCHEMA_VERSION = 1

export interface ManifestInput {
  courseId: string
  courseName: string
  /** ISO-8601 timestamp supplied by the caller. */
  exportedAt: string
  packageVersion: string
  piiMode: PiiMode
  counts: {
    liveQuizResponses: number
    participants: number
    invitations: number
    corrections: number
    liveQuizzes: number
    elementInstances: number
  }
  /** File names (relative to outputPath) to checksum, in display order. */
  files: string[]
}

/** Streams a file through SHA-256 and returns the hex digest (no full buffering). */
export async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

const DATA_DICTIONARY = {
  responses: {
    blockExecution:
      'Execution/run index of the enclosing element block for this participant (increments when a block is replayed).',
    correctionOnly:
      'true when the row was created by a lecturer point correction rather than a real participant submission.',
    appliedCorrectionsCount:
      'Number of AppliedPointCorrection records linked to this response (0 = no manual adjustments).',
    response:
      'Raw response JSON. In pseudonymize mode this is [redacted]; use the response_* columns instead.',
    response_choices:
      'SC/MC/KPRIM: comma-separated indices of selected choices.',
    response_value:
      'NUMERICAL value, FREE_TEXT answer, or CODE source (free text and source code redacted in pseudonymize mode).',
    response_selection: 'SELECTION: comma-separated selected entry ids.',
    response_assessment: 'CASE_STUDY: per-criterion assessment JSON.',
  },
  joins: {
    'corrections.liveQuizResponseId':
      'Foreign key into responses.liveQuizResponseId (+ elementBlockExecution) for correction audit joins.',
    'responses.elementInstanceId':
      'Foreign key into element_instances.elementInstanceId for full untruncated content and point config.',
  },
}

/** Writes manifest.json (0600) into outputPath and returns its path. */
export async function writeManifest(
  outputPath: string,
  input: ManifestInput
): Promise<string> {
  const fileEntries = await Promise.all(
    input.files.map(async (name) => {
      const sha256 = await computeSha256(join(outputPath, name))
      return [name, { sha256 }] as const
    })
  )

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    courseId: input.courseId,
    courseName: input.courseName,
    exportedAt: input.exportedAt,
    packageVersion: input.packageVersion,
    piiMode: input.piiMode,
    scope: {
      included: [
        'liveQuizResponse',
        'participation',
        'participantInvitation',
        'appliedPointCorrection',
      ],
      excluded: [
        'QuestionResponse (practice-quiz / microlearning)',
        'QuestionResponseDetail',
        'GroupActivityInstance',
      ],
      note: 'Live-quiz scope only. Courses with practice-quiz, microlearning, or group-activity data will not have those responses here.',
    },
    counts: input.counts,
    files: Object.fromEntries(fileEntries),
    dataDictionary: DATA_DICTIONARY,
  }

  const manifestPath = join(outputPath, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  chmodSync(manifestPath, 0o600)
  return manifestPath
}
