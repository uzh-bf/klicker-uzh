import type { PrismaClient } from '@klicker-uzh/prisma/client'

export const AUDIT_MONITOR_THRESHOLDS = {
  oldestPendingWarningSeconds: 2 * 60,
  oldestPendingCriticalSeconds: 10 * 60,
  pendingDepthWarning: 1_000,
  pendingDepthCritical: 10_000,
  dispatcherHeartbeatWarningSeconds: 2 * 60,
  dispatcherHeartbeatCriticalSeconds: 3 * 60,
} as const

export type AuditMonitorCounts = {
  pendingCount: number
  oldestPendingAt: Date | null
  quarantinedCount: number
  differentHashConflictCount: number
  deliveredUnsealedCount: number
  deliveredUnsealedBytes: number
}

export interface AuditMonitorRepository {
  readCounts(): Promise<AuditMonitorCounts>
}

export class PrismaAuditMonitorRepository implements AuditMonitorRepository {
  private readonly client: Pick<PrismaClient, 'assessmentAuditOutboxEvent'>

  constructor(client: Pick<PrismaClient, 'assessmentAuditOutboxEvent'>) {
    this.client = client
  }

  async readCounts(): Promise<AuditMonitorCounts> {
    const [pending, quarantinedCount, differentHashConflictCount, unsealed] =
      await Promise.all([
        this.client.assessmentAuditOutboxEvent.aggregate({
          where: { deliveryState: { in: ['PENDING', 'LEASED'] } },
          _count: true,
          _min: { recordedAt: true },
        }),
        this.client.assessmentAuditOutboxEvent.count({
          where: { deliveryState: 'QUARANTINED' },
        }),
        this.client.assessmentAuditOutboxEvent.count({
          where: {
            deliveryState: 'QUARANTINED',
            quarantineReason: 'DIFFERENT_HASH_CONFLICT',
          },
        }),
        this.client.assessmentAuditOutboxEvent.aggregate({
          where: { deliveryState: 'DELIVERED_UNSEALED' },
          _count: true,
          _sum: { canonicalByteLength: true },
        }),
      ])
    return {
      pendingCount: pending._count,
      oldestPendingAt: pending._min.recordedAt,
      quarantinedCount,
      differentHashConflictCount,
      deliveredUnsealedCount: unsealed._count,
      deliveredUnsealedBytes: unsealed._sum.canonicalByteLength ?? 0,
    }
  }
}

export type AuditMonitorSignal = {
  signal:
    | 'OLDEST_PENDING_SECONDS'
    | 'PENDING_DEPTH'
    | 'DISPATCHER_HEARTBEAT_SECONDS'
    | 'DIFFERENT_HASH_CONFLICT'
    | 'QUARANTINED_ROWS'
  severity: 'WARNING' | 'CRITICAL'
  value: number
  threshold: number
}

export type AuditMonitorSnapshot = AuditMonitorCounts & {
  observedAt: string
  oldestPendingSeconds: number
  dispatcherHeartbeatSeconds: number
  signals: AuditMonitorSignal[]
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
}

let dispatcherLastSuccessAt: Date | undefined
let monitorLastSuccessAt: Date | undefined
let mediaPolicyLastSuccessAt: Date | undefined
let mediaPolicyMinimumHorizonDays: number | undefined
let latestSnapshot: AuditMonitorSnapshot | undefined
const auditWorkerStartedAt = new Date()

export function recordAssessmentAuditDispatcherSuccess(at = new Date()): void {
  dispatcherLastSuccessAt = at
}

export function recordAssessmentAuditMonitorSuccess(
  snapshot: AuditMonitorSnapshot,
  at = new Date(snapshot.observedAt)
): void {
  monitorLastSuccessAt = at
  latestSnapshot = snapshot
}

export function recordAssessmentAuditMediaPolicySuccess(
  minimumHorizonDays: number | null,
  at = new Date()
): void {
  mediaPolicyLastSuccessAt = at
  mediaPolicyMinimumHorizonDays = minimumHorizonDays ?? Number.POSITIVE_INFINITY
}

function elapsedSeconds(now: Date, then: Date | null | undefined): number {
  if (then === null || then === undefined) {
    return 0
  }
  return Math.max(0, (now.getTime() - then.getTime()) / 1_000)
}

function thresholdSignal(input: {
  signal: AuditMonitorSignal['signal']
  value: number
  warning: number
  critical: number
}): AuditMonitorSignal | undefined {
  if (input.value >= input.critical) {
    return {
      signal: input.signal,
      severity: 'CRITICAL',
      value: input.value,
      threshold: input.critical,
    }
  }
  if (input.value >= input.warning) {
    return {
      signal: input.signal,
      severity: 'WARNING',
      value: input.value,
      threshold: input.warning,
    }
  }
  return undefined
}

export async function collectAssessmentAuditMonitorSnapshot(input: {
  repository: AuditMonitorRepository
  now?: Date
  dispatcherLastSuccess?: Date
  requireDispatcherHeartbeat?: boolean
}): Promise<AuditMonitorSnapshot> {
  const now = input.now ?? new Date()
  const counts = await input.repository.readCounts()
  const oldestPendingSeconds = elapsedSeconds(now, counts.oldestPendingAt)
  const lastDispatch =
    input.dispatcherLastSuccess ??
    dispatcherLastSuccessAt ??
    auditWorkerStartedAt
  const dispatcherHeartbeatSeconds = elapsedSeconds(now, lastDispatch)
  const signals: AuditMonitorSignal[] = []
  const possibleSignals = [
    thresholdSignal({
      signal: 'OLDEST_PENDING_SECONDS',
      value: oldestPendingSeconds,
      warning: AUDIT_MONITOR_THRESHOLDS.oldestPendingWarningSeconds,
      critical: AUDIT_MONITOR_THRESHOLDS.oldestPendingCriticalSeconds,
    }),
    thresholdSignal({
      signal: 'PENDING_DEPTH',
      value: counts.pendingCount,
      warning: AUDIT_MONITOR_THRESHOLDS.pendingDepthWarning,
      critical: AUDIT_MONITOR_THRESHOLDS.pendingDepthCritical,
    }),
    input.requireDispatcherHeartbeat === false
      ? undefined
      : thresholdSignal({
          signal: 'DISPATCHER_HEARTBEAT_SECONDS',
          value: dispatcherHeartbeatSeconds,
          warning: AUDIT_MONITOR_THRESHOLDS.dispatcherHeartbeatWarningSeconds,
          critical: AUDIT_MONITOR_THRESHOLDS.dispatcherHeartbeatCriticalSeconds,
        }),
  ]
  signals.push(
    ...possibleSignals.filter(
      (signal): signal is AuditMonitorSignal => signal !== undefined
    )
  )
  if (counts.differentHashConflictCount > 0) {
    signals.push({
      signal: 'DIFFERENT_HASH_CONFLICT',
      severity: 'CRITICAL',
      value: counts.differentHashConflictCount,
      threshold: 1,
    })
  }
  if (counts.quarantinedCount > 0) {
    signals.push({
      signal: 'QUARANTINED_ROWS',
      severity: 'CRITICAL',
      value: counts.quarantinedCount,
      threshold: 1,
    })
  }
  const status = signals.some((signal) => signal.severity === 'CRITICAL')
    ? 'CRITICAL'
    : signals.length > 0
      ? 'WARNING'
      : 'HEALTHY'
  return {
    ...counts,
    observedAt: now.toISOString(),
    oldestPendingSeconds,
    dispatcherHeartbeatSeconds,
    signals,
    status,
  }
}

function prometheusNumber(value: number | undefined): string {
  if (value === undefined) {
    return '0'
  }
  if (value === Number.POSITIVE_INFINITY) {
    return '+Inf'
  }
  return String(value)
}

export function renderAssessmentAuditPrometheusMetrics(
  environment: string,
  role = 'dispatcher'
): string {
  const safeEnvironment = environment.replaceAll(/[^a-zA-Z0-9_.-]/g, '_')
  const safeRole = role.replaceAll(/[^a-zA-Z0-9_.-]/g, '_')
  const metrics: Array<[string, string]> = [
    [
      'assessment_audit_worker_started_timestamp_seconds',
      prometheusNumber(auditWorkerStartedAt.getTime() / 1_000),
    ],
    [
      'assessment_audit_dispatcher_last_success_timestamp_seconds',
      prometheusNumber(
        dispatcherLastSuccessAt === undefined
          ? undefined
          : dispatcherLastSuccessAt.getTime() / 1_000
      ),
    ],
    [
      'assessment_audit_monitor_last_success_timestamp_seconds',
      prometheusNumber(
        monitorLastSuccessAt === undefined
          ? undefined
          : monitorLastSuccessAt.getTime() / 1_000
      ),
    ],
    [
      'assessment_audit_media_policy_last_success_timestamp_seconds',
      prometheusNumber(
        mediaPolicyLastSuccessAt === undefined
          ? undefined
          : mediaPolicyLastSuccessAt.getTime() / 1_000
      ),
    ],
    [
      'assessment_audit_media_policy_minimum_horizon_days',
      prometheusNumber(mediaPolicyMinimumHorizonDays),
    ],
    [
      'assessment_audit_outbox_pending',
      prometheusNumber(latestSnapshot?.pendingCount),
    ],
    [
      'assessment_audit_outbox_oldest_pending_seconds',
      prometheusNumber(latestSnapshot?.oldestPendingSeconds),
    ],
    [
      'assessment_audit_monitor_status',
      prometheusNumber(
        latestSnapshot === undefined
          ? undefined
          : latestSnapshot.status === 'CRITICAL'
            ? 2
            : latestSnapshot.status === 'WARNING'
              ? 1
              : 0
      ),
    ],
    [
      'assessment_audit_outbox_quarantined',
      prometheusNumber(latestSnapshot?.quarantinedCount),
    ],
    [
      'assessment_audit_delivery_conflicts',
      prometheusNumber(latestSnapshot?.differentHashConflictCount),
    ],
    [
      'assessment_audit_delivered_unsealed_bytes',
      prometheusNumber(latestSnapshot?.deliveredUnsealedBytes),
    ],
  ]
  return [
    `assessment_audit_worker_info{environment="${safeEnvironment}",role="${safeRole}"} 1`,
    ...metrics.map(
      ([name, value]) =>
        `${name}{environment="${safeEnvironment}",role="${safeRole}"} ${value}`
    ),
    '',
  ].join('\n')
}
