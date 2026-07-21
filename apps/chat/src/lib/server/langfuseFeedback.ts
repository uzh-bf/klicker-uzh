import { createTraceId } from '@langfuse/tracing'

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

const SCORE_NAME = 'user-feedback'

function getLangfuseConfig() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  // The SDK reads LANGFUSE_BASE_URL (LANGFUSE_BASEURL is its legacy spelling);
  // LANGFUSE_HOST, which turbo.json also lists, is not one it looks at.
  const baseUrl = process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_BASEURL

  if (!publicKey || !secretKey || !baseUrl) return null

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`,
  }
}

/**
 * Mirrors a participant's thumbs up/down onto the Langfuse trace of the message
 * they rated, so answer quality can be reviewed next to the generation itself.
 *
 * Best effort by design: the rating is already persisted in our own database by
 * the time this runs, and telemetry being down is not a reason to fail a
 * student's click. Every failure is logged and swallowed.
 *
 * Passing null deletes the score rather than leaving a retracted "helpful"
 * behind — a stale positive would quietly skew whatever the scores get used for.
 */
export async function recordFeedbackScore(
  messageId: string,
  rating: 'UP' | 'DOWN' | null
) {
  const config = getLangfuseConfig()
  if (!config) return

  try {
    const traceId = await getTraceIdForMessage(messageId)
    // Deterministic id makes a re-vote replace the previous score instead of
    // stacking a second one. Langfuse keys replacement on id + name + the score's
    // *date*, so a vote changed after midnight lands as a separate score.
    const scoreId = `${traceId}-${SCORE_NAME}`

    const response =
      rating === null
        ? await fetch(`${config.baseUrl}/api/public/scores/${scoreId}`, {
            method: 'DELETE',
            headers: { Authorization: config.authorization },
          })
        : await fetch(`${config.baseUrl}/api/public/scores`, {
            method: 'POST',
            headers: {
              Authorization: config.authorization,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: scoreId,
              traceId,
              name: SCORE_NAME,
              value: rating === 'UP' ? 1 : 0,
              dataType: 'BOOLEAN',
            }),
          })

    // A retracted vote that was never scored 404s, which is the desired end
    // state rather than a problem worth logging.
    if (!response.ok && !(rating === null && response.status === 404)) {
      console.error('Failed to record Langfuse feedback score:', {
        status: response.status,
        body: await response.text(),
      })
    }
  } catch (error) {
    console.error('Failed to record Langfuse feedback score:', error)
  }
}
