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
  constructor() {
    super('The adaptive calculation service is unavailable. Please try again.')
  }
}

// Server-only: the caller must authorize the attempt and grade the response
// before constructing this DTO. This client never accepts element contents.
export function createAdaptiveClient({
  baseUrl,
  token,
  timeoutMs = 12000,
  fetch: fetchRequest = globalThis.fetch,
}: {
  baseUrl: string
  token: string
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
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
    timeoutMs > 30000
  ) {
    throw new Error('Invalid adaptive engine configuration')
  }
  const endpoint = (path: string) =>
    new URL(path, `${base.href.replace(/\/$/, '')}/`)
  async function post(
    path: string,
    request:
      | DecisionRequest
      | PosteriorBatchRequest
      | EstimateRequest
      | ValidationRequest
      | BankAnalysisRequest
  ): Promise<unknown> {
    const body = JSON.stringify(request)
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES)
      throw new Error('Adaptive request exceeds the size limit')
    try {
      const response = await fetchRequest(endpoint(path), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      })
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
      } catch {
        throw new AdaptiveEngineUnavailableError()
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
      } catch {
        throw new AdaptiveEngineUnavailableError()
      }
    },
    async estimates(input: EstimateRequest): Promise<EstimateResponse> {
      const request = estimateRequestSchema.parse(input)
      try {
        return parseEstimateResponse(
          await post('adaptive/v1/estimates', request),
          request
        )
      } catch {
        throw new AdaptiveEngineUnavailableError()
      }
    },
    async validate(input: ValidationRequest): Promise<ValidationResponse> {
      const request = validationRequestSchema.parse(input)
      try {
        return parseValidationResponse(
          await post('adaptive/v1/validate', request),
          request
        )
      } catch {
        throw new AdaptiveEngineUnavailableError()
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
      } catch {
        throw new AdaptiveEngineUnavailableError()
      }
    },
  }
}

export * from './analysis.js'
