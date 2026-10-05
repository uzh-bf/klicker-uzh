import {
  type BankAnalysisRequest,
  type BankAnalysisResponse,
  bankAnalysisRequestSchema,
  parseBankAnalysisResponse,
} from './analysis.js'
import {
  type DecisionRequest,
  decisionRequestSchema,
  type EstimateRequest,
  estimateRequestSchema,
  type ValidationRequest,
  validationRequestSchema,
} from './contract.js'
import {
  type PosteriorBatchRequest,
  type PosteriorBatchResponse,
  parsePosteriorBatchResponse,
  posteriorBatchRequestSchema,
} from './posteriors.js'
import {
  type DecisionResponse,
  type EstimateResponse,
  parseDecisionResponse,
  parseEstimateResponse,
  parseValidationResponse,
  type ValidationResponse,
} from './response.js'

export {
  type DecisionRequest,
  decisionRequestSchema,
  type EstimateRequest,
  estimateRequestSchema,
  type ValidationRequest,
  validationRequestSchema,
} from './contract.js'
export {
  MAX_POSTERIOR_BATCH_RESPONSES,
  MAX_POSTERIOR_BATCH_SUBJECTS,
  MAX_POSTERIOR_RESPONSES_PER_SUBJECT,
  type PosteriorBatchRequest,
  type PosteriorBatchResponse,
  parsePosteriorBatchResponse,
  posteriorBatchRequestSchema,
  posteriorBatchResponseSchema,
} from './posteriors.js'
export {
  type DecisionResponse,
  decisionResponseSchema,
  type EstimateResponse,
  estimateResponseSchema,
  parseDecisionResponse,
  parseEstimateResponse,
  parseValidationResponse,
  type ValidationResponse,
  validationResponseSchema,
} from './response.js'

const MAX_RESPONSE_BYTES = 32 * 1024 * 1024
const MAX_REQUEST_BYTES = 8 * 1024 * 1024

export class AdaptiveEngineUnavailableError extends Error {
  readonly code = 'ADAPTIVE_ENGINE_UNAVAILABLE'
  // True when the engine answered with an overload status (503/429) on the
  // last attempt, so the caller can tell "busy, retry later" from a failure.
  readonly overloaded: boolean
  constructor({ overloaded = false }: { overloaded?: boolean } = {}) {
    super('The adaptive calculation service is unavailable. Please try again.')
    this.overloaded = overloaded
  }
}

export type AdaptiveEngineOverloadRetry = {
  // Total number of requests, including the first one.
  attempts: number
  baseDelayMs: number
  maxDelayMs: number
  // Upper bound on the summed backoff sleeps of one call.
  budgetMs: number
}

// The reference engine answers 503 while all of its calculation workers are
// busy. Four requests within ~1.5 s of backoff ride out a short burst without
// holding the caller much longer than one slow calculation would.
export const DEFAULT_ADAPTIVE_ENGINE_OVERLOAD_RETRY: AdaptiveEngineOverloadRetry =
  {
    attempts: 4,
    baseDelayMs: 150,
    maxDelayMs: 600,
    budgetMs: 1500,
  }

// A retry is only worth starting when this much of the call deadline remains.
const MIN_RETRY_REMAINING_MS = 250

const OVERLOAD_STATUSES = new Set([429, 503])

class AdaptiveEngineRetryableError extends Error {
  constructor(readonly overloaded: boolean) {
    super('Adaptive engine request is retryable')
  }
}

// Server-only: the caller must authorize the attempt and grade the response
// before constructing this DTO. This client never accepts element contents.
export function createAdaptiveClient({
  baseUrl,
  token,
  timeoutMs = 12000,
  fetch: fetchRequest = globalThis.fetch,
  overloadRetry = DEFAULT_ADAPTIVE_ENGINE_OVERLOAD_RETRY,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  now = Date.now,
  onRetry,
}: {
  baseUrl: string
  token: string
  // Deadline for the whole call, including overload retries.
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
  overloadRetry?: AdaptiveEngineOverloadRetry | false
  sleep?: (ms: number) => Promise<unknown>
  random?: () => number
  now?: () => number
  // Observability hook, called before each backoff sleep. It receives no
  // request data, only the retry number and whether the engine was busy.
  onRetry?: (retry: { retryNumber: number; overloaded: boolean }) => void
}) {
  const base = new URL(baseUrl)
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    token.length < 32 ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 30000 ||
    (overloadRetry !== false &&
      (!Number.isInteger(overloadRetry.attempts) ||
        overloadRetry.attempts < 1 ||
        overloadRetry.attempts > 8 ||
        overloadRetry.baseDelayMs < 0 ||
        overloadRetry.maxDelayMs < overloadRetry.baseDelayMs ||
        overloadRetry.budgetMs < 0 ||
        overloadRetry.budgetMs > 5000))
  ) {
    throw new Error('Invalid adaptive engine configuration')
  }
  const endpoint = (path: string) =>
    new URL(path, `${base.href.replace(/\/$/, '')}/`)
  type EngineRequest =
    | DecisionRequest
    | PosteriorBatchRequest
    | EstimateRequest
    | ValidationRequest
    | BankAnalysisRequest
  async function post(path: string, request: EngineRequest): Promise<unknown> {
    const body = JSON.stringify(request)
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES)
      throw new Error('Adaptive request exceeds the size limit')
    const startedAt = now()
    const attempts = overloadRetry === false ? 1 : overloadRetry.attempts
    let sleptMs = 0
    for (let attempt = 1; ; attempt++) {
      const remainingMs = timeoutMs - (now() - startedAt)
      try {
        return await postOnce(path, body, Math.max(1, remainingMs))
      } catch (error) {
        if (!(error instanceof AdaptiveEngineRetryableError)) throw error
        if (overloadRetry === false || attempt >= attempts)
          throw new AdaptiveEngineUnavailableError({
            overloaded: error.overloaded,
          })
        // Equal jitter: keep half of the exponential step, randomize the rest
        // so callers rejected together do not come back together.
        const ceilingMs = Math.min(
          overloadRetry.baseDelayMs * 2 ** (attempt - 1),
          overloadRetry.maxDelayMs
        )
        const delayMs = Math.round(ceilingMs / 2 + random() * (ceilingMs / 2))
        const remainingAfterDelayMs = timeoutMs - (now() - startedAt) - delayMs
        if (
          sleptMs + delayMs > overloadRetry.budgetMs ||
          remainingAfterDelayMs < MIN_RETRY_REMAINING_MS
        )
          throw new AdaptiveEngineUnavailableError({
            overloaded: error.overloaded,
          })
        sleptMs += delayMs
        onRetry?.({ retryNumber: attempt, overloaded: error.overloaded })
        await sleep(delayMs)
      }
    }
  }
  async function postOnce(
    path: string,
    body: string,
    deadlineMs: number
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetchRequest(endpoint(path), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(deadlineMs),
        redirect: 'error',
      })
    } catch (error) {
      // A refused or reset connection (a restarting replica) is transient; a
      // deadline abort is not, because the call has no time left to retry.
      const name = (error as { name?: string }).name
      if (name === 'TimeoutError' || name === 'AbortError')
        throw new AdaptiveEngineUnavailableError()
      throw new AdaptiveEngineRetryableError(false)
    }
    if (OVERLOAD_STATUSES.has(response.status)) {
      await response.body?.cancel().catch(() => undefined)
      throw new AdaptiveEngineRetryableError(true)
    }
    try {
      if (
        !response.ok ||
        !response.headers.get('content-type')?.startsWith('application/json') ||
        !response.body
      ) {
        await response.body?.cancel()
        throw new AdaptiveEngineUnavailableError()
      }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > MAX_RESPONSE_BYTES)
            throw new AdaptiveEngineUnavailableError()
          chunks.push(value)
        }
      } finally {
        await reader.cancel()
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    } catch {
      throw new AdaptiveEngineUnavailableError()
    }
  }
  return {
    async decide(input: DecisionRequest): Promise<DecisionResponse> {
      // Strict validation rejects extra fields instead of accidentally sending
      // question text, solutions, or participant identity across the boundary.
      const request = decisionRequestSchema.parse(input)
      try {
        return parseDecisionResponse(
          await post('adaptive/v1/decide', request),
          request
        )
      } catch (error) {
        throw toUnavailable(error)
      }
    },
    async posteriors(
      input: PosteriorBatchRequest
    ): Promise<PosteriorBatchResponse> {
      const request = posteriorBatchRequestSchema.parse(input)
      try {
        return parsePosteriorBatchResponse(
          await post('adaptive/v1/posteriors', request),
          request
        )
      } catch (error) {
        throw toUnavailable(error)
      }
    },
    async estimates(input: EstimateRequest): Promise<EstimateResponse> {
      const request = estimateRequestSchema.parse(input)
      try {
        return parseEstimateResponse(
          await post('adaptive/v1/estimates', request),
          request
        )
      } catch (error) {
        throw toUnavailable(error)
      }
    },
    async validate(input: ValidationRequest): Promise<ValidationResponse> {
      const request = validationRequestSchema.parse(input)
      try {
        return parseValidationResponse(
          await post('adaptive/v1/validate', request),
          request
        )
      } catch (error) {
        throw toUnavailable(error)
      }
    },
    async analyzeBank(
      input: BankAnalysisRequest
    ): Promise<BankAnalysisResponse> {
      const request = bankAnalysisRequestSchema.parse(input)
      try {
        return parseBankAnalysisResponse(
          await post('adaptive/v1/bank-analysis', request),
          request
        )
      } catch (error) {
        throw toUnavailable(error)
      }
    },
  }
}

function toUnavailable(error: unknown): AdaptiveEngineUnavailableError {
  // Keep the overload signal; never forward upstream messages or parse errors.
  return error instanceof AdaptiveEngineUnavailableError
    ? error
    : new AdaptiveEngineUnavailableError()
}

export * from './analysis.js'
