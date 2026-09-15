import { randomUUID } from 'node:crypto'
import {
  AzureImmutableAuditMediaStore,
  AzureTableAppendSink,
  auditMediaContentAddress,
  baselinePartPayloadSchema,
  collectAssessmentAuditMonitorSnapshot,
  createAzureAuditClients,
  dispatchAssessmentAuditOutbox,
  PrismaAuditMonitorRepository,
  PrismaAuditOutboxRepository,
  parseCanonicalAuditEnvelope,
  readAzureAuditStorageConfig,
  recordAssessmentAuditDispatcherSuccess,
  recordAssessmentAuditMediaPolicySuccess,
  recordAssessmentAuditMonitorSuccess,
  renewActiveAssessmentMediaPolicies,
  retentionBatchFor,
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
    const capacityBytes = Number(
      process.env.ASSESSMENT_AUDIT_DELIVERED_UNSEALED_CAPACITY_BYTES ?? 0
    )
    const growthBytesPerWeek = Number(
      process.env.ASSESSMENT_AUDIT_DELIVERED_UNSEALED_GROWTH_BYTES_PER_WEEK ?? 0
    )
    const snapshot = await collectAssessmentAuditMonitorSnapshot({
      repository: new PrismaAuditMonitorRepository(globalCtx.prisma),
      ...(Number.isFinite(capacityBytes) && capacityBytes > 0
        ? { deliveredUnsealedCapacityBytes: capacityBytes }
        : {}),
      ...(Number.isFinite(growthBytesPerWeek) && growthBytesPerWeek > 0
        ? { deliveredUnsealedGrowthBytesPerWeek: growthBytesPerWeek }
        : {}),
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
      deliveredUnsealedCapacityWeeksRemaining:
        snapshot.deliveredUnsealedCapacityWeeksRemaining,
      requiredMediaCaptureFailureCount:
        snapshot.requiredMediaCaptureFailureCount,
      coveredSubmissionWithoutTerminalCount:
        snapshot.coveredSubmissionWithoutTerminalCount,
      oldestCoveredSubmissionWithoutTerminalSeconds:
        snapshot.oldestCoveredSubmissionWithoutTerminalSeconds,
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
      },
      orderBy: [{ liveQuizId: 'asc' }, { lifecycleEpoch: 'asc' }],
      take: 100,
      ...(scopeCursor === undefined
        ? {}
        : {
            cursor: { liveQuizId_lifecycleEpoch: scopeCursor },
            skip: 1,
          }),
      select: {
        liveQuizId: true,
        lifecycleEpoch: true,
        retentionAnchorAt: true,
      },
    })
    if (scopes.length === 0) break

    for (const scope of scopes) {
      let eventCursor: string | undefined
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
          if (payload.content.kind === 'MEDIA_REFERENCE') {
            const media = payload.content.media
            const retainUntil =
              scope.retentionAnchorAt === null
                ? undefined
                : retentionBatchFor(scope.retentionAnchorAt)
            if (
              media.blobName !== auditMediaContentAddress(media.contentHash)
            ) {
              throw new Error(
                `Assessment media blob ${media.blobName} has conflicting content hashes`
              )
            }
            // Stream duplicates: the store never shortens retention, and each
            // scope must retain its horizon without an unbounded deduplication map.
            yield {
              blobName: media.blobName,
              contentHash: media.contentHash,
              ...(retainUntil === undefined ? {} : { retainUntil }),
            }
          }
        }
        eventCursor = events.at(-1)!.eventId
      }
    }
    const lastScope = scopes.at(-1)!
    scopeCursor = {
      liveQuizId: lastScope.liveQuizId,
      lifecycleEpoch: lastScope.lifecycleEpoch,
    }
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
