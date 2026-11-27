import type { AuditEnvelope } from '../contract/envelope.js'

export type AppendAuditRecord = {
  envelope: AuditEnvelope
  canonicalEnvelope: string
}

export type AppendAuditResult =
  | { outcome: 'CREATED'; durableReceiptId: string }
  | { outcome: 'IDENTICAL_REPLAY'; durableReceiptId: string }

export interface AppendOnlyAuditSink {
  append(record: AppendAuditRecord): Promise<AppendAuditResult>
}

export class AuditAppendConflictError extends Error {
  readonly eventId: string

  constructor(eventId: string) {
    super(`Append-only audit conflict for event ${eventId}`)
    this.name = 'AuditAppendConflictError'
    this.eventId = eventId
  }
}
