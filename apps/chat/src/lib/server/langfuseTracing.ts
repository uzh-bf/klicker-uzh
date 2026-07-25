import { createTraceId } from '@langfuse/tracing'

/**
 * Killswitch shared with `instrumentation.ts`, which skips registering the
 * span processor entirely when it is off. Scoring honours the same flag: with
 * tracing disabled — as it is on staging today — a score would attach to a
 * trace that was never emitted.
 */
export const isAiTelemetryEnabled =
  process.env.CHAT_ENABLE_AI_TELEMETRY !== 'false'

/**
 * Langfuse v4 is OpenTelemetry-based: a trace is addressed by its W3C trace id,
 * and the v3 `metadata.langfuseTraceId` convention is silently ignored. To reach
 * a trace later from an unrelated request we therefore have to *derive* the same
 * id on both sides, which `createTraceId` does deterministically from a seed.
 *
 * The seed is the assistant message id, so a rating on a message can always find
 * the generation that produced it.
 */
export function getTraceIdForMessage(messageId: string) {
  return createTraceId(messageId)
}

/**
 * A span context needs a parent span id alongside the trace id. Nothing points
 * back at this id — it only anchors the stream's spans into the derived trace —
 * so it just has to be stable and a valid 16-hex-digit value.
 */
export function getParentSpanContext(traceId: string) {
  return { traceId, spanId: traceId.slice(0, 16), traceFlags: 1 }
}
