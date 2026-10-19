// Host-side validation of messages from the sandboxed code runner. The runner
// executes untrusted learner code, so every field it sends is bounded and
// re-typed here, and provenance is always assigned by the host.

export const MAX_RUNNER_MESSAGE_CHARS = 256 * 1024
export const RUNNER_OUTPUT_CAP = 64 * 1024
export const MAX_RUNNER_MESSAGES_PER_RUN = 32
const MAX_ERROR_CHARS = 2000

export type CodeRunStatus =
  | 'ok'
  | 'error'
  | 'timeout'
  | 'stopped'
  | 'unavailable'
  | 'unknown'

export interface CodeRunResult {
  attemptId: string
  status: CodeRunStatus
  stdout: string
  stderr: string
  truncated: boolean
  error: string | null
  /** At least one network or script access was blocked by the runner policy. */
  blockedAccess: boolean
  provenance: 'browser-reported'
}

export interface RunnerExpectation {
  generation: number
  attemptId: string | null
}

export type RunnerEvent =
  | { kind: 'ready' }
  | { kind: 'init-error'; error: string }
  | { kind: 'diagnostic' }
  | {
      kind: 'result'
      status: 'ok' | 'error' | 'unknown'
      stdout: string
      stderr: string
      truncated: boolean
      error: string | null
    }

export type RunnerRejection =
  | 'unserializable'
  | 'oversize'
  | 'bad-shape'
  | 'stale-attempt'

function boundedText(value: unknown, limit: number): [string, boolean] {
  const text = typeof value === 'string' ? value : ''
  return text.length > limit ? [text.slice(0, limit), true] : [text, false]
}

/**
 * Turns one runner message into a typed event, or names why it is rejected.
 * A result must carry the current generation and attempt; anything else is a
 * late or forged message and must not change what the learner sees.
 */
export function parseRunnerMessage(
  data: unknown,
  expected: RunnerExpectation
): { event: RunnerEvent } | { rejected: RunnerRejection } {
  let size: number
  try {
    size = JSON.stringify(data)?.length ?? 0
  } catch {
    return { rejected: 'unserializable' }
  }
  if (size > MAX_RUNNER_MESSAGE_CHARS) return { rejected: 'oversize' }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { rejected: 'bad-shape' }
  }
  const message = data as Record<string, unknown>
  switch (message.type) {
    case 'ready':
      return { event: { kind: 'ready' } }
    case 'init-error':
      return {
        event: {
          kind: 'init-error',
          error: boundedText(message.error, MAX_ERROR_CHARS)[0],
        },
      }
    case 'diagnostic':
      return { event: { kind: 'diagnostic' } }
    case 'result': {
      if (
        expected.attemptId === null ||
        message.attemptId !== expected.attemptId ||
        message.generation !== expected.generation
      ) {
        return { rejected: 'stale-attempt' }
      }
      const [stdout, stdoutCut] = boundedText(message.stdout, RUNNER_OUTPUT_CAP)
      const [stderr, stderrCut] = boundedText(message.stderr, RUNNER_OUTPUT_CAP)
      const error =
        typeof message.error === 'string'
          ? boundedText(message.error, MAX_ERROR_CHARS)[0]
          : null
      return {
        event: {
          kind: 'result',
          status:
            message.status === 'ok' || message.status === 'error'
              ? message.status
              : 'unknown',
          stdout,
          stderr,
          truncated: message.truncated === true || stdoutCut || stderrCut,
          error,
        },
      }
    }
    default:
      return { rejected: 'bad-shape' }
  }
}

export function hostResult(
  attemptId: string,
  status: CodeRunStatus,
  fields: Partial<
    Pick<
      CodeRunResult,
      'stdout' | 'stderr' | 'truncated' | 'error' | 'blockedAccess'
    >
  > = {}
): CodeRunResult {
  return {
    attemptId,
    status,
    stdout: fields.stdout ?? '',
    stderr: fields.stderr ?? '',
    truncated: fields.truncated ?? false,
    error: fields.error ?? null,
    blockedAccess: fields.blockedAccess ?? false,
    provenance: 'browser-reported',
  }
}
