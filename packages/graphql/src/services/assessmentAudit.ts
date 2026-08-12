import { randomUUID } from 'node:crypto'
import {
  AzureTableAppendSink,
  AzureImmutableAuditMediaStore,
  baselinePartPayloadSchema,
  collectAssessmentAuditMonitorSnapshot,
  createAzureAuditClients,
  dispatchAssessmentAuditOutbox,
  PrismaAuditMonitorRepository,
  PrismaAuditOutboxRepository,
  parseCanonicalAuditEnvelope,
  readAzureAuditStorageConfig,
  recordAssessmentAuditDispatcherSuccess,
  recordAssessmentAuditMonitorSuccess,
  recordAssessmentAuditMediaPolicySuccess,
  renewActiveAssessmentMediaPolicies,
} from '@klicker-uzh/audit'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'

let auditClients: ReturnType<typeof createAzureAuditClients> | undefined

function getAuditClients() {
  auditClients ??= createAzureAuditClients(readAzureAuditStorageConfig())
  return auditClients
}

function auditWorkerId(): string {
  const hostname = (process.env.HOSTNAME ?? 'local')
    .replaceAll(/[^a-zA-Z0-9_.:-]/g, '-')
    .slice(0, 64)
  return `audit:${hostname}:${randomUUID()}`
}

export const handleDispatchAssessmentAuditOutbox: HatchetHandlers['handleDispatchAssessmentAuditOutbox'] =
  async (_input, globalCtx, executionCtx) => {
    const clients = getAuditClients()
    const summary = await dispatchAssessmentAuditOutbox({
      repository: new PrismaAuditOutboxRepository(globalCtx.prisma),
      sink: new AzureTableAppendSink(clients.tables),
      workerId: auditWorkerId(),
    })
    recordAssessmentAuditDispatcherSuccess()
    await executionCtx.logger.info(
      JSON.stringify({
        operation: 'ASSESSMENT_AUDIT_DISPATCH',
        ...summary,
      })
    )
    return true
  }

export const handleMonitorAssessmentAudit: HatchetHandlers['handleMonitorAssessmentAudit'] =
  async (_input, globalCtx, executionCtx) => {
    const snapshot = await collectAssessmentAuditMonitorSnapshot({
      repository: new PrismaAuditMonitorRepository(globalCtx.prisma),
    })
    recordAssessmentAuditMonitorSuccess(snapshot)
    const metadata = {
      operation: 'ASSESSMENT_AUDIT_MONITOR',
      observedAt: snapshot.observedAt,
      status: snapshot.status,
      pendingCount: snapshot.pendingCount,
      oldestPendingSeconds: snapshot.oldestPendingSeconds,
      quarantinedCount: snapshot.quarantinedCount,
      differentHashConflictCount: snapshot.differentHashConflictCount,
      deliveredUnsealedCount: snapshot.deliveredUnsealedCount,
      deliveredUnsealedBytes: snapshot.deliveredUnsealedBytes,
      signals: snapshot.signals,
    }
    if (snapshot.status === 'CRITICAL') {
      await executionCtx.logger.error(JSON.stringify(metadata))
      throw new Error('Assessment audit monitor detected a critical signal')
    }
    await executionCtx.logger.info(JSON.stringify(metadata))
    return true
  }

export async function* activeAssessmentMediaReferences(
  client: Pick<
    DB.PrismaClient,
    'assessmentAuditScope' | 'assessmentAuditOutboxEvent'
  >
) {
  let scopeCursor: { liveQuizId: string; lifecycleEpoch: number } | undefined
  while (true) {
    const scopes = await client.assessmentAuditScope.findMany({
      where: {
        coverageState: DB.AssessmentAuditCoverageState.COVERED,
        retentionAnchorAt: null,
      },
      orderBy: [{ liveQuizId: 'asc' }, { lifecycleEpoch: 'asc' }],
      take: 100,
      ...(scopeCursor === undefined
        ? {}
        : {
            cursor: { liveQuizId_lifecycleEpoch: scopeCursor },
            skip: 1,
          }),
      select: { liveQuizId: true, lifecycleEpoch: true },
    })
    if (scopes.length === 0) return

    for (const scope of scopes) {
      let eventCursor: string | undefined
      const seen = new Set<string>()
      while (true) {
        const events = await client.assessmentAuditOutboxEvent.findMany({
          where: {
            liveQuizId: scope.liveQuizId,
            lifecycleEpoch: scope.lifecycleEpoch,
            eventType: 'ASSESSMENT_BASELINE_PART_RECORDED',
          },
          orderBy: { eventId: 'asc' },
          take: 250,
          ...(eventCursor === undefined
            ? {}
            : { cursor: { eventId: eventCursor }, skip: 1 }),
          select: { eventId: true, canonicalEnvelope: true },
        })
        if (events.length === 0) break
        for (const event of events) {
          const envelope = parseCanonicalAuditEnvelope(event.canonicalEnvelope)
          const payload = baselinePartPayloadSchema.parse(envelope.payload)
          if (
            payload.content.kind === 'MEDIA_REFERENCE' &&
            !seen.has(payload.content.media.blobName)
          ) {
            seen.add(payload.content.media.blobName)
            yield {
              blobName: payload.content.media.blobName,
              contentHash: payload.content.media.contentHash,
            }
          }
        }
        eventCursor = events.at(-1)!.eventId
      }
    }
    scopeCursor = scopes.at(-1)!
  }
}

export const handleRenewAssessmentAuditMediaPolicies: HatchetHandlers['handleRenewAssessmentAuditMediaPolicies'] =
  async (_input, globalCtx, executionCtx) => {
    const clients = getAuditClients()
    const summary = await renewActiveAssessmentMediaPolicies({
      references: activeAssessmentMediaReferences(globalCtx.prisma),
      store: new AzureImmutableAuditMediaStore(clients.blobs.media),
    })
    recordAssessmentAuditMediaPolicySuccess(summary.minimumHorizonDays)
    await executionCtx.logger.info(
      JSON.stringify({
        operation: 'ASSESSMENT_AUDIT_MEDIA_POLICY_RENEWAL',
        ...summary,
      })
    )
    return true
  }
