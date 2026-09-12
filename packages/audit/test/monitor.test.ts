import {
  type AuditMonitorCounts,
  collectAssessmentAuditMonitorSnapshot,
  recordAssessmentAuditDispatcherSuccess,
  recordAssessmentAuditMonitorSuccess,
  renderAssessmentAuditPrometheusMetrics,
} from '../src/index.js'

function repository(counts: AuditMonitorCounts) {
  return { readCounts: async () => counts }
}

const EMPTY: AuditMonitorCounts = {
  pendingCount: 0,
  oldestPendingAt: null,
  quarantinedCount: 0,
  differentHashConflictCount: 0,
  deliveredUnsealedCount: 0,
  deliveredUnsealedBytes: 0,
  requiredMediaCaptureFailureCount: 0,
  coveredSubmissionWithoutTerminalCount: 0,
  oldestCoveredSubmissionWithoutTerminalAt: null,
}

describe('assessment audit monitor', () => {
  it('reports a healthy metadata-only snapshot', async () => {
    const now = new Date('2026-08-11T08:10:00.000Z')
    const snapshot = await collectAssessmentAuditMonitorSnapshot({
      repository: repository(EMPTY),
      now,
      dispatcherLastSuccess: new Date('2026-08-11T08:09:30.000Z'),
    })

    expect(snapshot.status).toBe('HEALTHY')
    expect(snapshot.signals).toEqual([])
    expect(JSON.stringify(snapshot)).not.toMatch(
      /participant|liveQuiz|payload|canonical/i
    )
  })

  it('marks backlog, conflicts, quarantine, and stale heartbeat critical', async () => {
    const snapshot = await collectAssessmentAuditMonitorSnapshot({
      repository: repository({
        ...EMPTY,
        pendingCount: 10_000,
        oldestPendingAt: new Date('2026-08-11T07:59:00.000Z'),
        quarantinedCount: 2,
        differentHashConflictCount: 1,
        requiredMediaCaptureFailureCount: 1,
        coveredSubmissionWithoutTerminalCount: 1,
        oldestCoveredSubmissionWithoutTerminalAt: new Date(
          '2026-08-11T08:00:00.000Z'
        ),
      }),
      now: new Date('2026-08-11T08:10:00.000Z'),
      dispatcherLastSuccess: new Date('2026-08-11T08:06:00.000Z'),
    })

    expect(snapshot.status).toBe('CRITICAL')
    expect(snapshot.signals.map(({ signal }) => signal)).toEqual([
      'OLDEST_PENDING_SECONDS',
      'PENDING_DEPTH',
      'DISPATCHER_HEARTBEAT_SECONDS',
      'DIFFERENT_HASH_CONFLICT',
      'QUARANTINED_ROWS',
      'REQUIRED_MEDIA_CAPTURE_FAILURES',
      'OLDEST_COVERED_SUBMISSION_WITHOUT_TERMINAL_SECONDS',
    ])
  })

  it('renders heartbeat and backlog metrics without an extra dependency', async () => {
    const at = new Date('2026-08-11T08:10:00.000Z')
    recordAssessmentAuditDispatcherSuccess(at)
    const snapshot = await collectAssessmentAuditMonitorSnapshot({
      repository: repository({ ...EMPTY, deliveredUnsealedBytes: 512 }),
      now: at,
    })
    recordAssessmentAuditMonitorSuccess(snapshot, at)

    const metrics = renderAssessmentAuditPrometheusMetrics('stg')
    expect(metrics).toContain(
      'assessment_audit_monitor_last_success_timestamp_seconds{environment="stg",role="dispatcher"} 1786435800'
    )
    expect(metrics).toContain(
      'assessment_audit_delivered_unsealed_bytes{environment="stg",role="dispatcher"} 512'
    )
    expect(metrics).toContain(
      'assessment_audit_monitor_status{environment="stg",role="dispatcher"} 0'
    )
    expect(metrics).toContain(
      'assessment_audit_worker_started_timestamp_seconds{environment="stg",role="dispatcher"}'
    )
    expect(metrics).not.toContain('participant')
  })

  it('forecasts delivered-unsealed capacity and raises the configured thresholds', async () => {
    const now = new Date('2026-08-11T08:10:00.000Z')
    const warning = await collectAssessmentAuditMonitorSnapshot({
      repository: repository({ ...EMPTY, deliveredUnsealedBytes: 2_500 }),
      now,
      dispatcherLastSuccess: now,
      deliveredUnsealedCapacityBytes: 10_000,
      deliveredUnsealedGrowthBytesPerWeek: 1_000,
    })
    expect(warning.deliveredUnsealedCapacityWeeksRemaining).toBe(7.5)
    expect(warning.signals).toContainEqual({
      signal: 'DELIVERED_UNSEALED_CAPACITY_WEEKS_REMAINING',
      severity: 'WARNING',
      value: 7.5,
      threshold: 8,
    })

    const critical = await collectAssessmentAuditMonitorSnapshot({
      repository: repository({ ...EMPTY, deliveredUnsealedBytes: 7_500 }),
      now,
      dispatcherLastSuccess: now,
      deliveredUnsealedCapacityBytes: 10_000,
      deliveredUnsealedGrowthBytesPerWeek: 1_000,
    })
    expect(critical.deliveredUnsealedCapacityWeeksRemaining).toBe(2.5)
    expect(critical.signals).toContainEqual({
      signal: 'DELIVERED_UNSEALED_CAPACITY_WEEKS_REMAINING',
      severity: 'CRITICAL',
      value: 2.5,
      threshold: 4,
    })
  })
})
