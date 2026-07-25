import { prisma } from '@klicker-uzh/prisma'
import { createTraceId } from '@langfuse/tracing'
import { createHash } from 'node:crypto'

/**
 * Killswitch shared with `instrumentation.ts`, which skips registering the
 * span processor entirely when it is off. Scoring honours the same flag: with
 * tracing disabled — as it is on staging today — a score would attach to a
 * trace that was never emitted.
 */
export const isAiTelemetryEnabled =
  process.env.CHAT_ENABLE_AI_TELEMETRY !== 'false'

/** Where the SDK itself points when no base url is configured. */
const LANGFUSE_CLOUD_URL = 'https://cloud.langfuse.com'

/** A slow or unreachable Langfuse must never hold a student's click open. */
const SCORE_TIMEOUT_MS = 5000
const SCORE_SYNC_TIMEOUT_MS = 55_000

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
  if (!isAiTelemetryEnabled) return null

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  // Resolved exactly as the SDK resolves it — LANGFUSE_BASE_URL, its legacy
  // spelling LANGFUSE_BASEURL, then the cloud default. Anything stricter would
  // silently drop scores on a config where traces still get exported.
  const baseUrl =
    process.env.LANGFUSE_BASE_URL ??
    process.env.LANGFUSE_BASEURL ??
    LANGFUSE_CLOUD_URL

  if (!publicKey || !secretKey) return null

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
        ? await fetch(
            `${config.baseUrl}/api/public/scores/${encodeURIComponent(scoreId)}`,
            {
              method: 'DELETE',
              headers: { Authorization: config.authorization },
              signal: AbortSignal.timeout(SCORE_TIMEOUT_MS),
            }
          )
        : await fetch(`${config.baseUrl}/api/public/scores`, {
            method: 'POST',
            headers: {
              Authorization: config.authorization,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(SCORE_TIMEOUT_MS),
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

/**
 * Synchronizes the latest persisted rating without delaying the API response.
 *
 * `after()` callbacks from rapid votes can overlap or run on different app
 * instances. A transaction-scoped PostgreSQL advisory lock orders those
 * callbacks by message, and the database read happens only after the lock is
 * held. This avoids a slow older Langfuse request overwriting a newer vote.
 *
 * The advisory lock is deliberately separate from the ChatMessage row lock:
 * participant-facing rating updates remain fast while telemetry catches up in
 * the background.
 */
export async function syncFeedbackScore(messageId: string) {
  if (!getLangfuseConfig()) return

  const lockId = createHash('sha256')
    .update(messageId)
    .digest()
    .readBigInt64BE()

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockId})`
        const message = await tx.chatMessage.findUnique({
          where: { id: messageId },
          select: { rating: true },
        })
        if (!message) return

        await recordFeedbackScore(messageId, message.rating)
      },
      {
        maxWait: SCORE_TIMEOUT_MS,
        // Includes time waiting for an older score sync plus the bounded
        // Langfuse request. Keep it below the route's 60-second max duration.
        timeout: SCORE_SYNC_TIMEOUT_MS,
      }
    )
  } catch (error) {
    console.error('Failed to synchronize Langfuse feedback score:', error)
  }
}
