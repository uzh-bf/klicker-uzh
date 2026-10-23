import { randomUUID } from 'node:crypto'
import {
  type AuditManifest,
  type AuditManifestStore,
  type AuditSealRepository,
  type AzureTableAuditReader,
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
  // Outbox states: events default to DELIVERED_UNSEALED until marked SEALED.
  const inFlight = new Set<string>()
  const repository: AuditSealRepository = {
    listQuizIds: async () => [quiz],
    getSealingState: vi.fn(async () => ({
      sealable: new Set(
        records
          .map(({ envelope }) => envelope.eventId)
          .filter((id) => !marked.has(id) && !inFlight.has(id))
      ),
      inFlight: new Set(inFlight),
      sealed: new Set(marked),
    })),
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
    verifyEvents: vi.fn(
      async ({
        eventIds,
      }: {
        eventIds: readonly string[]
      }): Promise<
        Awaited<ReturnType<AzureTableAuditReader['verifyEvents']>>
      > => {
        const byId = new Map(
          records.map((record) => [record.envelope.eventId, record])
        )
        return {
          verified: eventIds.flatMap((id) => {
            const record = byId.get(id)
            return record === undefined ? [] : [record]
          }),
          failures: eventIds
            .filter((id) => !byId.has(id))
            .map((eventId) => ({
              eventId,
              reason: 'EVIDENCE_MISSING' as const,
              detail: 'root row missing',
            })),
        }
      }
    ),
    exportQuizWithFailures: vi.fn(
      async (): Promise<
        Awaited<ReturnType<AzureTableAuditReader['exportQuizWithFailures']>>
      > => ({
        verified: [...records],
        failures: [],
      })
    ),
  }
  return {
    records,
    stored,
    marked,
    inFlight,
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

  it('waits for delivery: in-flight events are neither read nor sealed', async () => {
    const f = fixture()
    const delivering = event()
    f.records.push(delivering)
    f.inFlight.add(delivering.envelope.eventId)
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1,
      awaitingDeliveryCount: 1,
      deferredCount: 0,
      failures: [],
    })
    expect(
      f.reader.verifyEvents.mock.calls.flatMap(([{ eventIds }]) => eventIds)
    ).not.toContain(delivering.envelope.eventId)
    expect(
      f.stored.flatMap(({ manifest }) => manifest.events.map((e) => e.eventId))
    ).not.toContain(delivering.envelope.eventId)
    f.inFlight.clear()
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1,
      manifestCount: 1,
      failures: [],
    })
  })

  it('still fails on verification failures of delivered events', async () => {
    const f = fixture()
    f.reader.verifyEvents.mockImplementation(async ({ eventIds }) => ({
      verified: [],
      failures: eventIds.map((eventId) => ({
        eventId,
        reason: 'EVIDENCE_MISSING' as const,
        detail: 'root row missing',
      })),
    }))
    const result = await sealAssessmentAudit(f)
    expect(result.failures[0]?.detail).toContain('verification failures')
    expect(f.stored).toHaveLength(0)
  })

  it('reads only the sealable events and each new batch, not the history', async () => {
    const f = fixture()
    f.records.push(...Array.from({ length: 249 }, () => event()))
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 250,
      failures: [],
    })
    const late = event()
    f.records.push(late)
    f.reader.verifyEvents.mockClear()

    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 1,
      manifestCount: 1,
      failures: [],
    })
    // One read of the sealable backlog, one re-read of the published batch.
    expect(
      f.reader.verifyEvents.mock.calls.map(([{ eventIds }]) => [...eventIds])
    ).toEqual([[late.envelope.eventId], [late.envelope.eventId]])
    expect(f.reader.exportQuizWithFailures).not.toHaveBeenCalled()
  })

  it('detects whole manifest loss from the PostgreSQL SEALED checkpoint', async () => {
    const f = fixture()
    await sealAssessmentAudit(f)
    expect(f.marked.size).toBe(1)
    f.stored.length = 0
    const result = await sealAssessmentAudit(f)
    expect(result.failures[0]?.detail).toContain(
      'SEALED in PostgreSQL but absent from every manifest'
    )
  })

  it('renews retention without reading evidence when nothing is sealable', async () => {
    const f = fixture()
    await sealAssessmentAudit(f)
    f.reader.verifyEvents.mockClear()
    const list = vi.spyOn(f.manifests, 'list')
    expect(await sealAssessmentAudit(f)).toMatchObject({
      sealedCount: 0,
      manifestCount: 0,
      failures: [],
    })
    expect(list).toHaveBeenCalledWith(
      quiz,
      expect.objectContaining({ repairPending: true })
    )
    expect(f.reader.verifyEvents).not.toHaveBeenCalled()
  })

  it('rejects non-positive batch limits', async () => {
    await expect(
      sealAssessmentAudit({ ...fixture(), maxBatchEvents: 0 })
    ).rejects.toThrow('positive integers')
  })

  it('redacts other participants from manifests in participant exports', async () => {
    const f = fixture()
    const own = event()
    const other = event()
    const participantId = randomUUID()
    own.envelope.scope.participantId = participantId
    other.envelope.scope.participantId = randomUUID()
    f.records.push(own, other)
    await sealAssessmentAudit(f)
    const report = await buildAuditExport({
      reader: f.reader,
      manifests: f.manifests,
      liveQuizId: quiz,
      participantId,
    })
    expect(report.verification.sealStatus).toBe('SEALED')
    const listed = report.manifests!.flatMap(({ manifest }) =>
      manifest.events.map(({ eventId }) => eventId)
    )
    expect(listed).toContain(own.envelope.eventId)
    expect(listed).not.toContain(other.envelope.eventId)
    expect(report.manifests![0]!.redactedEventCount).toBe(1)
    const full = await buildAuditExport({
      reader: f.reader,
      manifests: f.manifests,
      liveQuizId: quiz,
    })
    expect(full.manifests![0]!.redactedEventCount).toBeUndefined()
  })

  it('keeps Table evidence statuses when only the manifest listing fails', async () => {
    const f = fixture()
    const healthy = await buildAuditExport({ ...f, liveQuizId: quiz })
    f.manifests.list = async () => {
      throw new Error('broken manifest chain')
    }
    const report = await buildAuditExport({ ...f, liveQuizId: quiz })
    expect(report.verification).toMatchObject({
      sealStatus: 'INVALID',
      sealFailures: ['broken manifest chain'],
      evidenceStatus: healthy.verification.evidenceStatus,
      coverageStatus: healthy.verification.coverageStatus,
    })
  })
})
