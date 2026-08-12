import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  type AssessmentBaselineContent,
  buildAssessmentBaseline,
  buildAuditExport,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  serializeAuditExport,
  writePrivateAtomicFile,
} from '../src/index.js'

const LIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111'
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222'
const CORRELATION_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '44444444-4444-4444-8444-444444444444'

function exportReader(
  verified: ReturnType<typeof participantEvidence>[],
  failures: {
    eventId: string
    reason:
      | 'RETENTION_INDEX_MISSING'
      | 'LOCATOR_MISSING'
      | 'EVIDENCE_MISSING'
      | 'VERIFICATION_FAILED'
    detail: string
  }[] = []
) {
  return {
    exportQuizWithFailures: async () => ({ verified, failures }),
  }
}

function baselineEvidence() {
  const baselineId = randomUUID()
  const capturedAt = '2026-08-12T10:00:00.000Z'
  const contents: AssessmentBaselineContent[] = [
    {
      kind: 'LECTURER_PERMISSION',
      userId: USER_ID,
      permission: 'OWNER',
      effective: true,
    },
    {
      kind: 'ASSESSMENT_CONFIGURATION',
      courseId: null,
      configuration: {
        name: 'Internal title',
        displayName: 'Assessment',
        description: null,
        accessMode: 'RESTRICTED',
        publicationStatus: 'DRAFT',
        reviewStatus: 'REVIEWED',
        availableFrom: null,
        isLiveQAEnabled: false,
        isConfusionFeedbackEnabled: false,
        isModerationEnabled: true,
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
        areInstancesOutdated: false,
        pointsMultiplier: 1,
        defaultPoints: 10,
        defaultCorrectPoints: 5,
        maximumBonusPoints: 45,
        secondsToZeroBonus: 20,
        activeBlockId: null,
      },
    },
  ]
  const baseline = buildAssessmentBaseline({
    baselineId,
    baselineKind: 'CREATION',
    capturedAt,
    contents,
  })
  const context = createTrustedAuditContext({
    recordedVia: 'TRANSACTIONAL_OUTBOX',
    receivedAt: capturedAt,
    recordedAt: capturedAt,
    actor: { kind: 'SYSTEM' },
    authorization: { decision: 'ALLOWED', authScope: 'SYSTEM' },
    scope: { liveQuizId: LIVE_QUIZ_ID, lifecycleEpoch: 1 },
    correlationId: CORRELATION_ID,
  })
  const rootRecord = createCanonicalAuditEvent(context, {
    eventType: 'ASSESSMENT_BASELINE_ROOT_RECORDED',
    producerOperationId: baselineId + ':root',
    payload: baseline.root,
  })
  const partRecords = baseline.parts.map((part) =>
    createCanonicalAuditEvent(context, {
      eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
      producerOperationId: baselineId + ':part:' + part.partKey,
      payload: part,
    })
  )
  const activation = createCanonicalAuditEvent(context, {
    eventType: 'ASSESSMENT_AUDIT_ACTIVATED',
    producerOperationId: baselineId + ':activate',
    payload: {
      baselineId,
      baselineKind: 'CREATION',
      coverageState: 'COVERED',
      activatedAt: capturedAt,
    },
  })
  return [
    ...partRecords,
    rootRecord,
    activation,
  ].map((record) => ({
    ...record,
    status: 'VERIFIED' as const,
    sealStatus: 'UNSEALED' as const,
  }))
}

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
      reader: exportReader([]),
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
      reader: exportReader([evidence]),
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

  it('reports COVERED only when a baseline reconstructs and activation exists', async () => {
    const evidence = baselineEvidence()
    const document = await buildAuditExport({
      reader: exportReader(evidence),
      liveQuizId: LIVE_QUIZ_ID,
      generatedAt: new Date('2026-08-12T10:01:00.000Z'),
    })

    expect(document.verification).toMatchObject({
      evidenceStatus: 'VERIFIED',
      baselineStatus: 'PRESENT',
      coverageStatus: 'COVERED',
      limitations: [],
    })
    expect(document.verification.baselineReconstructions).toHaveLength(1)
    expect(document.verification.baselineReconstructions[0]).toMatchObject({
      status: 'COMPLETE',
      partCount: 2,
      issues: [],
    })
  })

  it('reports BASELINE_INCOMPLETE when parts are missing', async () => {
    const evidence = baselineEvidence()
    const rootRecord = evidence.find(
      ({ envelope }) => envelope.eventType === 'ASSESSMENT_BASELINE_ROOT_RECORDED'
    )!
    const activation = evidence.find(
      ({ envelope }) => envelope.eventType === 'ASSESSMENT_AUDIT_ACTIVATED'
    )!
    const document = await buildAuditExport({
      reader: exportReader([rootRecord, activation]),
      liveQuizId: LIVE_QUIZ_ID,
      generatedAt: new Date('2026-08-12T10:01:00.000Z'),
    })

    expect(document.verification).toMatchObject({
      baselineStatus: 'INCOMPLETE',
      coverageStatus: 'BASELINE_INCOMPLETE',
    })
    expect(document.verification.baselineReconstructions[0].status).toBe(
      'INCOMPLETE'
    )
  })

  it('reports BASELINE_CONFLICTED when a part key is duplicated', async () => {
    const evidence = baselineEvidence()
    const partRecord = evidence.find(
      ({ envelope }) => envelope.eventType === 'ASSESSMENT_BASELINE_PART_RECORDED'
    )!
    const document = await buildAuditExport({
      reader: exportReader([...evidence, partRecord]),
      liveQuizId: LIVE_QUIZ_ID,
      generatedAt: new Date('2026-08-12T10:01:00.000Z'),
    })

    expect(document.verification).toMatchObject({
      baselineStatus: 'CONFLICTED',
      coverageStatus: 'BASELINE_CONFLICTED',
    })
  })

  it('reports RETENTION_INDEX_MISSING when an event fails retention verification', async () => {
    const evidence = baselineEvidence()
    const document = await buildAuditExport({
      reader: exportReader(evidence, [
        {
          eventId: evidence[0].envelope.eventId,
          reason: 'RETENTION_INDEX_MISSING',
          detail: 'Audit retention index for event is invalid',
        },
      ]),
      liveQuizId: LIVE_QUIZ_ID,
      generatedAt: new Date('2026-08-12T10:01:00.000Z'),
    })

    expect(document.verification).toMatchObject({
      evidenceStatus: 'PARTIAL',
      coverageStatus: 'RETENTION_INDEX_MISSING',
    })
    expect(document.verification.verificationFailures).toHaveLength(1)
  })
})
