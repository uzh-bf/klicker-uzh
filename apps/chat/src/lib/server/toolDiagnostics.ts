import { createHash } from 'node:crypto'

// The chat route logs a bounded, content-free summary of each streamed step's
// tool activity. This module owns that summary so call/result/error
// correlation stays unit-testable without importing the Next.js route. Raw
// payloads never leave it: only a byte size and a short digest are produced.

const HASH_DIGEST_LENGTH = 12

export type ToolDiagnosticEvent = 'tool-call' | 'tool-result' | 'tool-error'

const TOOL_EVENT_TYPES: readonly ToolDiagnosticEvent[] = [
  'tool-call',
  'tool-result',
  'tool-error',
]

/**
 * "absent" means the part carries no value for that field at all (a tool call
 * has no output). It is distinct from an explicit null, an empty container
 * (an empty string, array, or object), and a real value, so a missing output
 * is never mistaken for a null one.
 */
export type ToolDiagnosticValueState = 'absent' | 'null' | 'empty' | 'present'

export type ToolDiagnosticValue = {
  state: ToolDiagnosticValueState
  bytes: number | null
  hash: string | null
}

export type ToolDiagnostic = {
  event: ToolDiagnosticEvent
  toolName: string
  toolCallId: string | null
  input: ToolDiagnosticValue
  output: ToolDiagnosticValue
}

export type ToolDiagnosticsStep = { content?: readonly unknown[] }

export function hashSnippet(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, HASH_DIGEST_LENGTH)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function safeSerialize(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? null
  } catch {
    return null
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === '') return true
  if (Array.isArray(value)) return value.length === 0
  const record = asRecord(value)
  return record !== null && Object.keys(record).length === 0
}

/** Reads the first present field, treating an explicit undefined as absent. */
function readField(
  source: Record<string, unknown>,
  keys: readonly string[]
): { present: boolean; value: unknown } {
  for (const key of keys) {
    if (key in source) {
      const value = source[key]
      return value === undefined
        ? { present: false, value: undefined }
        : { present: true, value }
    }
  }
  return { present: false, value: undefined }
}

function describeValue(value: unknown, present: boolean): ToolDiagnosticValue {
  if (!present) return { state: 'absent', bytes: null, hash: null }
  const state: ToolDiagnosticValueState =
    value === null ? 'null' : isEmptyValue(value) ? 'empty' : 'present'
  const serialized = safeSerialize(value)
  if (serialized === null) return { state, bytes: null, hash: null }
  return {
    state,
    bytes: Buffer.byteLength(serialized, 'utf8'),
    hash: hashSnippet(serialized),
  }
}

/**
 * Summarizes one step's tool parts without exposing payload content. Inputs
 * and outputs are reduced to a state, byte size, and digest; args/result
 * remain supported for older SDK part shapes.
 */
export function collectStepToolDiagnostics(
  step: ToolDiagnosticsStep
): ToolDiagnostic[] {
  const diagnostics: ToolDiagnostic[] = []
  for (const part of step?.content ?? []) {
    const record = asRecord(part)
    if (!record) continue
    const event = TOOL_EVENT_TYPES.find(
      (candidate) => candidate === record.type
    )
    if (!event) continue

    const input = readField(record, ['input', 'args'])
    const output = readField(record, ['output', 'result'])
    diagnostics.push({
      event,
      toolName:
        typeof record.toolName === 'string' ? record.toolName : 'unknown',
      toolCallId:
        typeof record.toolCallId === 'string' ? record.toolCallId : null,
      input: describeValue(input.value, input.present),
      output: describeValue(output.value, output.present),
    })
  }
  return diagnostics
}

/**
 * Only tool-call events represent the model invoking a tool. Results and
 * errors echo an earlier call, so they must not inflate the reported count or
 * names; a call and its result share the same toolCallId.
 */
export function summarizeToolDiagnostics(
  diagnostics: readonly ToolDiagnostic[]
): { toolCallsCount: number; toolCallNames: string[] } {
  const calls = diagnostics.filter(
    (diagnostic) => diagnostic.event === 'tool-call'
  )
  return {
    toolCallsCount: calls.length,
    toolCallNames: Array.from(new Set(calls.map((call) => call.toolName))),
  }
}
