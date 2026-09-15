import { randomUUID } from 'node:crypto'
import {
  buildAssessmentBaselinePart,
  createCanonicalAuditEvent,
  createTrustedAuditContext,
  retentionBatchFor,
} from '@klicker-uzh/audit'
import { describe, expect, it, vi } from 'vitest'
import { activeAssessmentMediaReferences } from '../src/services/assessmentAudit.js'

const contentHash = 'a'.repeat(64)
const blobName = `sha256/${contentHash}`

function scope(retentionAnchorAt: Date | null = null) {
  return { liveQuizId: randomUUID(), lifecycleEpoch: 1, retentionAnchorAt }
}

function event(liveQuizId: string, hash = contentHash, name = blobName) {
  const capturedAt = '2026-09-10T00:00:00.000Z'
  const record = createCanonicalAuditEvent(
    createTrustedAuditContext({
      recordedVia: 'TRANSACTIONAL_OUTBOX',
      receivedAt: capturedAt,
      actor: { kind: 'SYSTEM' },
      authorization: {
        decision: 'NOT_APPLICABLE',
        authScope: 'SYSTEM_ROLLOUT',
      },
      scope: { liveQuizId, lifecycleEpoch: 1 },
      correlationId: randomUUID(),
    }),
    {
      eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
      producerOperationId: randomUUID(),
      payload: buildAssessmentBaselinePart({
        baselineId: randomUUID(),
        baselineKind: 'CREATION',
        capturedAt,
        content: {
          kind: 'MEDIA_REFERENCE',
          media: {
            mediaId: randomUUID(),
            sourceUrl: 'https://example.blob.core.windows.net/media/image.png',
            contentHash: hash,
            blobName: name,
            byteLength: 42,
            mimeType: 'image/png',
            sourceReferenceHash: 'b'.repeat(64),
          },
        },
      }),
    }
  )
  return {
    eventId: record.envelope.eventId,
    canonicalEnvelope: record.canonicalEnvelope,
  }
}

function fixture() {
  const scopes = vi.fn().mockResolvedValue([])
  const events = vi.fn().mockResolvedValue([])
  const client = {
    assessmentAuditScope: { findMany: scopes },
    assessmentAuditOutboxEvent: { findMany: events },
  } as unknown as Parameters<typeof activeAssessmentMediaReferences>[0]
  return { client, scopes, events }
}

describe('bounded assessment media-reference enumeration', () => {
  it('yields before fetching another page and stops work when the consumer stops', async () => {
    const { client, scopes, events } = fixture()
    const firstScope = scope()
    scopes.mockResolvedValueOnce([firstScope])
    events.mockResolvedValueOnce([event(firstScope.liveQuizId)])
    const references = activeAssessmentMediaReferences(client)

    expect(await references.next()).toMatchObject({
      done: false,
      value: { blobName, contentHash },
    })
    expect(scopes).toHaveBeenCalledTimes(1)
    expect(events).toHaveBeenCalledTimes(1)
    await references.return()
    expect(scopes).toHaveBeenCalledTimes(1)
    expect(events).toHaveBeenCalledTimes(1)
  })

  it('uses bounded keyset pages and preserves duplicate references and per-scope horizons', async () => {
    const { client, scopes, events } = fixture()
    const completed = scope(new Date('2026-03-01T00:00:00.000Z'))
    const active = scope()
    const firstEvent = event(completed.liveQuizId)
    scopes.mockResolvedValueOnce([completed]).mockResolvedValueOnce([active])
    events
      .mockResolvedValueOnce([firstEvent])
      .mockResolvedValueOnce([event(completed.liveQuizId)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([event(active.liveQuizId)])
    const found: Array<{
      blobName: string
      contentHash: string
      retainUntil?: Date
    }> = []
    for await (const reference of activeAssessmentMediaReferences(client)) {
      found.push(reference)
    }

    const completedReference = {
      blobName,
      contentHash,
      retainUntil: retentionBatchFor(completed.retentionAnchorAt!),
    }
    expect(found).toEqual([
      completedReference,
      completedReference,
      { blobName, contentHash },
    ])
    expect(scopes).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 100,
        skip: 1,
        cursor: {
          liveQuizId_lifecycleEpoch: {
            liveQuizId: completed.liveQuizId,
            lifecycleEpoch: completed.lifecycleEpoch,
          },
        },
      })
    )
    expect(events).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 250,
        skip: 1,
        cursor: { eventId: firstEvent.eventId },
      })
    )
    expect(events).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        where: {
          liveQuizId: active.liveQuizId,
          lifecycleEpoch: 1,
          eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
        },
        take: 250,
      })
    )
    expect(events.mock.calls[3]![0]).not.toHaveProperty('cursor')
    expect(scopes.mock.calls.every(([query]) => query.take === 100)).toBe(true)
    expect(events.mock.calls.every(([query]) => query.take === 250)).toBe(true)
  })

  it('rejects a blob-name/hash mismatch even on the first reference', async () => {
    const { client, scopes, events } = fixture()
    const firstScope = scope()
    scopes.mockResolvedValueOnce([firstScope])
    events.mockResolvedValueOnce([event(firstScope.liveQuizId, 'c'.repeat(64))])
    await expect(
      activeAssessmentMediaReferences(client).next()
    ).rejects.toThrow()
  })

  it('fails closed on malformed canonical evidence instead of skipping it', async () => {
    const { client, scopes, events } = fixture()
    scopes.mockResolvedValueOnce([scope()])
    events.mockResolvedValueOnce([
      { eventId: randomUUID(), canonicalEnvelope: '{}' },
    ])
    await expect(
      activeAssessmentMediaReferences(client).next()
    ).rejects.toThrow()
  })
})
