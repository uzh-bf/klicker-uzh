import { describe, expect, it, vi } from 'vitest'
import {
  createImportExportTelemetryEvent,
  emitImportExportTelemetry,
  type ImportExportTelemetryInput,
} from '../src/lib/importExportTelemetry.js'

describe('import/export telemetry', () => {
  it('emits only the versioned allowlisted envelope', () => {
    const secretMarkers = [
      'authored question text',
      'https://storage.example/private/blob.zip?sig=secret',
      'artifact-raw-id',
      'receipt-raw-id',
      'owner-raw-id',
      'original-file-name.zip',
      'token.payload.signature',
      'Error: infrastructure detail',
      'raw-operation-value',
      'raw-outcome-value',
      'raw-service-value',
    ]
    const unsafeInput = {
      operation: 'validate',
      outcome: 'failure',
      code: secretMarkers[0],
      correlationId: secretMarkers[1],
      packageBytes: 123,
      durationMs: 4,
      authoredText: secretMarkers[0],
      blobUrl: secretMarkers[1],
      artifactId: secretMarkers[2],
      receiptId: secretMarkers[3],
      ownerId: secretMarkers[4],
      filename: secretMarkers[5],
      token: secretMarkers[6],
      error: new Error(secretMarkers[7]),
    } as unknown as ImportExportTelemetryInput

    const event = createImportExportTelemetryEvent(unsafeInput, {
      nodeEnvironment: 'production',
      now: new Date('2026-07-13T12:00:00.000Z'),
    })
    const serialized = JSON.stringify(event)

    expect(event).toMatchObject({
      schemaVersion: 1,
      event: 'import_export_operation',
      occurredAt: '2026-07-13T12:00:00.000Z',
      service: 'graphql',
      environment: 'production',
      operation: 'validate',
      outcome: 'failure',
      code: 'UNCLASSIFIED',
      metrics: { packageBytes: 123, durationMs: 4 },
    })
    expect(Object.keys(event).sort()).toEqual(
      [
        'code',
        'correlationId',
        'environment',
        'event',
        'metrics',
        'occurredAt',
        'operation',
        'outcome',
        'schemaVersion',
        'service',
      ].sort()
    )
    for (const marker of secretMarkers) {
      expect(serialized).not.toContain(marker)
    }
  })

  it('normalizes runtime-bypassed categorical values', () => {
    const event = createImportExportTelemetryEvent({
      operation: 'raw-operation-value',
      outcome: 'raw-outcome-value',
      service: 'raw-service-value',
    } as unknown as ImportExportTelemetryInput)

    expect(event).toMatchObject({
      operation: 'unknown',
      outcome: 'unknown',
      service: 'unknown',
    })
    expect(JSON.stringify(event)).not.toContain('raw-')
  })

  it('drops invalid metrics and normalizes staging without exposing raw env values', () => {
    const event = createImportExportTelemetryEvent(
      {
        operation: 'cleanup',
        outcome: 'success',
        code: 'CLEANUP_COMPLETED',
        deletedCount: 3,
        attemptedCount: -1,
        durationMs: Number.POSITIVE_INFINITY,
        backlogRemaining: false,
      },
      { nodeEnvironment: 'stg-secret-cluster-name' }
    )

    expect(event.environment).toBe('unknown')
    expect(event.metrics).toEqual({ deletedCount: 3 })
    expect(JSON.stringify(event)).not.toContain('stg-secret-cluster-name')
  })

  it('never changes the operation outcome when a telemetry sink fails', () => {
    const sink = vi.fn(() => {
      throw new Error('sink unavailable')
    })

    expect(() =>
      emitImportExportTelemetry(
        { operation: 'export', outcome: 'success' },
        sink
      )
    ).not.toThrow()
    expect(sink).toHaveBeenCalledOnce()
  })

  it('keeps forbidden markers out of the default stdout/stderr path', () => {
    const marker = 'secret-authored-text-or-token'
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      emitImportExportTelemetry({
        operation: 'import',
        outcome: 'failure',
        code: marker,
        token: marker,
        filename: marker,
        rawError: new Error(marker),
      } as unknown as ImportExportTelemetryInput)

      const stdout = JSON.stringify(info.mock.calls)
      const stderr = JSON.stringify(error.mock.calls)
      expect(stdout).not.toContain(marker)
      expect(stderr).not.toContain(marker)
      expect(info).toHaveBeenCalledOnce()
      expect(error).not.toHaveBeenCalled()
    } finally {
      info.mockRestore()
      error.mockRestore()
    }
  })
})
