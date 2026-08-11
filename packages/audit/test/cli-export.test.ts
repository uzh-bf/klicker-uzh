import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildAuditExport,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  serializeAuditExport,
  writePrivateAtomicFile,
} from '../src/index.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222'
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333'

function participantEvidence() {
  const record = createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: '2026-08-11T08:00:00.000Z',
      recordedAt: '2026-08-11T08:00:00.001Z',
      actor: { kind: 'PARTICIPANT', participantId: PARTICIPANT_ID },
      authorization: {
        decision: 'DENIED',
        authScope: 'PARTICIPANT',
        requiredPermission: 'ASSESSMENT_PARTICIPATE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: LIVE_QUIZ_ID },
      },
      scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 1 },
      correlationId: CORRELATION_ID,
    }),
    {
      eventType: 'ASSESSMENT_ACTION_REJECTED',
      producerOperationId: `${CORRELATION_ID}:rejected`,
      scope: { participantId: PARTICIPANT_ID },
      outcome: 'REJECTED',
      payload: {
        actionType: 'SUBMIT_RESPONSE',
        reasonCode: 'INVALID_STATE',
      },
    }
  )
  return {
    ...record,
    status: 'VERIFIED' as const,
    sealStatus: 'UNSEALED' as const,
  }
}

describe('owner audit export', () => {
  it('reports no rollout record without claiming that an assessment existed', async () => {
    const document = await buildAuditExport({
      reader: { exportQuiz: async () => [] },
      liveQuizId: LIVE_QUIZ_ID,
      generatedAt: new Date('2026-08-11T08:00:00.000Z'),
    })

    expect(document.verification).toMatchObject({
      evidenceStatus: 'NO_ROLLOUT_RECORD',
      baselineStatus: 'NOT_APPLICABLE',
      coverageStatus: 'NO_ROLLOUT_RECORD',
      participantStatus: 'NOT_FILTERED',
      limitations: ['PRE_INSTRUMENTATION_DELETION_UNKNOWABLE'],
      sealStatus: 'UNSEALED',
    })
    expect(serializeAuditExport(document)).not.toContain('undefined')
  })

  it('does not claim coverage when evidence exists without a baseline', async () => {
    const evidence = participantEvidence()
    const document = await buildAuditExport({
      reader: { exportQuiz: async () => [evidence] },
      liveQuizId: LIVE_QUIZ_ID,
      participantId: PARTICIPANT_ID,
      generatedAt: new Date('2026-08-11T08:01:00.000Z'),
    })

    expect(document.verification).toMatchObject({
      evidenceStatus: 'VERIFIED',
      baselineStatus: 'MISSING',
      coverageStatus: 'BASELINE_MISSING',
      participantStatus: 'PRESENT',
      participantEventCount: 1,
    })
  })

  it('writes private output atomically and refuses an implicit overwrite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'klicker-audit-export-'))
    const outputPath = join(directory, 'evidence.json')
    try {
      await writePrivateAtomicFile({ outputPath, content: '{"first":true}\n' })
      expect(await readFile(outputPath, 'utf8')).toBe('{"first":true}\n')
      expect((await stat(outputPath)).mode & 0o777).toBe(0o600)

      await expect(
        writePrivateAtomicFile({ outputPath, content: '{"second":true}\n' })
      ).rejects.toThrow('Refusing to overwrite')
      expect(await readFile(outputPath, 'utf8')).toBe('{"first":true}\n')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('replaces output only when force is explicit and keeps mode 0600', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'klicker-audit-export-'))
    const outputPath = join(directory, 'evidence.json')
    try {
      await writeFile(outputPath, 'old', { mode: 0o644 })
      await writePrivateAtomicFile({
        outputPath,
        content: 'new',
        force: true,
      })
      expect(await readFile(outputPath, 'utf8')).toBe('new')
      expect((await stat(outputPath)).mode & 0o777).toBe(0o600)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
