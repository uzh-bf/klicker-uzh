import { randomUUID } from 'node:crypto'
import {
  AzureTableAppendSink,
  collectAssessmentAuditMonitorSnapshot,
  createAzureAuditClients,
  dispatchAssessmentAuditOutbox,
  PrismaAuditMonitorRepository,
  PrismaAuditOutboxRepository,
  readAzureAuditStorageConfig,
  recordAssessmentAuditDispatcherSuccess,
  recordAssessmentAuditMonitorSuccess,
} from '@klicker-uzh/audit'
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
