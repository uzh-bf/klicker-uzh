import { randomUUID } from 'node:crypto'
import {
  type AuditManifest,
  type AuditManifestStore,
  type AuditSealRepository,
  buildAuditExport,
  canonicalizeJson,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  type StoredAuditManifest,
  sealAssessmentAudit,
  sha256Hex,
  type VerifiedAuditEvidence,
} from '../src/index.js'

const quiz = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-09-28T10:00:00.000Z')

function event(epoch = 1): VerifiedAuditEvidence {
  const record = createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: now.toISOString(),
      recordedAt: now.toISOString(),
      actor: { kind: 'USER', userId: randomUUID() },
      authorization: {
        decision: 'ALLOWED',
        authScope: 'LECTURER',
        requiredPermission: 'LIVE_QUIZ_WRITE',
        resolvedObjectScope: { type: 'LIVE_QUIZ', id: quiz },
      },
      scope: { liveQuizId: quiz, lifecycleEpoch: epoch },
      correlationId: randomUUID(),
    }),
    {
      eventType: 'ASSESSMENT_STARTED',
      producerOperationId: randomUUID(),
      outcome: 'SUCCEEDED',
      payload: { fromState: 'PUBLISHED', toState: 'RUNNING' },
    }
  )
  return {
    envelope: record.envelope,
    canonicalEnvelope: record.canonicalEnvelope,
    status: 'VERIFIED',
    sealStatus: 'UNSEALED',
  }
}

function fixture() {
  const records = [event()]
  const stored: StoredAuditManifest[] = []
  const marked = new Set<string>()
  const manifests: AuditManifestStore = {
    list: async () => [...stored],
    create: vi.fn(async (manifest: AuditManifest) => {
      const winner = stored.find(
        (item) =>
          item.manifest.sequence === manifest.sequence &&
          item.manifest.lifecycleEpoch === manifest.lifecycleEpoch
      )
      if (winner) return winner
      const item = {
        manifest,
        manifestHash: sha256Hex(canonicalizeJson(manifest)),
        blobName: 'synthetic',
        versionId: String(stored.length + 1),
      }
      stored.push(item)
      return item
    }),
  }
  const repository: AuditSealRepository = {
    listQuizIds: async () => [quiz],
    markSealed: vi.fn(async (items) => {
      let count = 0
      for (const item of items) {
        if (!marked.has(item.envelope.eventId)) count++
        marked.add(item.envelope.eventId)
      }
      return count
    }),
  }
  const reader = {
    exportQuizWithFailures: vi.fn(async () => ({
      verified: [...records],
      failures: [],
    })),
  }
  return {
    records,
    stored,
    marked,
    manifests,
    repository,
    reader,
    now: () => now,
  }
}

describe('assessment sealing', () => {
  it('reports batch exhaustion and drains it on the next run', async () => {
    const f = fixture()
    f.records.push(...Array.from({ length: 1000 }, () => event()))
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1000,
      deferredCount: 1,
      failures: [],
    })
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1,
      deferredCount: 0,
      failures: [],
    })
  })

  it('never seals changed canonical bytes or duplicate manifest membership', async () => {
    const f = fixture()
    await sealAssessmentAudit(f)
    f.records[0]!.canonicalEnvelope += ' '
    expect(
      (await buildAuditExport({ ...f, liveQuizId: quiz })).verification
        .sealStatus
    ).toBe('INVALID')
    f.records[0]!.canonicalEnvelope = f.records[0]!.canonicalEnvelope.trimEnd()
    f.stored.push(f.stored[0]!)
    expect(
      (await buildAuditExport({ ...f, liveQuizId: quiz })).verification
        .sealFailures?.[0]
    ).toContain('Duplicate')
  })

  it('seals, replays idempotently, and includes late events and new epochs', async () => {
    const f = fixture()
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1,
      manifestCount: 1,
      failures: [],
    })
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 0,
      manifestCount: 0,
    })
    f.records.push(event(), event(2))
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 2,
      manifestCount: 2,
      failures: [],
    })
    const epochOne = f.stored.filter(
      (item) => item.manifest.lifecycleEpoch === 1
    )
    expect(epochOne[1]!.manifest.previousManifestHash).toBe(
      epochOne[0]!.manifestHash
    )
    expect(f.marked.size).toBe(3)
  })

  it('recovers a crash after immutable publication before the DB transition', async () => {
    const f = fixture()
    const mark = f.repository.markSealed
    f.repository.markSealed = async (items, date) => {
      if (items.length) throw new Error('database unavailable')
      return mark(items, date)
    }
    expect((await sealAssessmentAudit(f)).failures).toHaveLength(1)
    expect(f.stored).toHaveLength(1)
    expect(f.marked.size).toBe(0)
    f.repository.markSealed = mark
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1,
      manifestCount: 0,
      failures: [],
    })
  })

  it('does not mark an event when immutable publication fails', async () => {
    const f = fixture()
    f.manifests.create = async () => {
      throw new Error('WORM unavailable')
    }
    expect((await sealAssessmentAudit(f)).failures).toHaveLength(1)
    expect(f.marked.size).toBe(0)
  })

  it('rereads evidence after publication and fails on deletion', async () => {
    const f = fixture()
    const create = f.manifests.create
    f.manifests.create = async (manifest) => {
      const result = await create(manifest)
      f.records.length = 0
      return result
    }
    expect((await sealAssessmentAudit(f)).failures).toHaveLength(1)
    expect(f.marked.size).toBe(0)
  })

  it('concurrent sealers converge on the conditional-create winner', async () => {
    const f = fixture()
    const results = await Promise.all([
      sealAssessmentAudit(f),
      sealAssessmentAudit(f),
    ])
    expect(results.flatMap((item) => item.failures)).toEqual([])
    expect(f.stored).toHaveLength(1)
    expect(f.marked.size).toBe(1)
  })

  it('export detects complete loss from Table discovery and changed bytes', async () => {
    const f = fixture()
    await sealAssessmentAudit(f)
    const exportInput = {
      reader: f.reader,
      manifests: f.manifests,
      liveQuizId: quiz,
    }
    expect((await buildAuditExport(exportInput)).verification.sealStatus).toBe(
      'SEALED'
    )
    f.records.push(event())
    expect((await buildAuditExport(exportInput)).verification.sealStatus).toBe(
      'PARTIALLY_SEALED'
    )
    f.records.shift()
    const missing = await buildAuditExport(exportInput)
    expect(missing.verification).toMatchObject({
      sealStatus: 'INVALID',
      evidenceStatus: 'PARTIAL',
      coverageStatus: 'EVIDENCE_INCOMPLETE',
    })
    expect(missing.verification.sealFailures?.[0]).toContain(
      'missing or changed'
    )
  })

  it('fails export closed when the blob inventory cannot be verified', async () => {
    const f = fixture()
    f.manifests.list = async () => {
      throw new Error('broken manifest chain')
    }
    const report = await buildAuditExport({ ...f, liveQuizId: quiz })
    expect(report.verification.sealStatus).toBe('INVALID')
  })
})
