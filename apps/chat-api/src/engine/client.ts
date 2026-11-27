import {
  CHAT_ENGINE_CONTRACT_VERSION,
  type EngineContractVersion,
  type EngineExplanationDraftRequest,
  type EngineExplanationDraftResult,
  engineExplanationDraftRequestSchema,
  engineExplanationDraftResultSchema,
  EXPLANATION_WRITER_CAPABILITY_HEADER,
  CHAT_ENGINE_MAX_V2_REQUEST_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES,
  MCP_EXECUTION_TOKEN_HEADER,
  parseEngineManifest,
  type SupportedEngineChatRequest,
  type SupportedEngineManifest,
  TRACEPARENT_HEADER,
  TRACESTATE_HEADER,
} from '@klicker-uzh/chat-engine-contract'

export type EngineClient = {
  manifest(options?: {
    signal?: AbortSignal
  }): Promise<SupportedEngineManifest & { explanationWriter?: true }>
  explanationDraft?(
    request: EngineExplanationDraftRequest,
    options: { providerAuthorization?: string; signal: AbortSignal }
  ): Promise<EngineExplanationDraftResult>
  chat(
    request: SupportedEngineChatRequest,
    options: {
      providerAuthorization?: string
      mcpExecutionToken?: string
      traceContext?: { traceparent: string; tracestate?: string }
      signal: AbortSignal
    }
  ): Promise<Response>
}

export type EngineClientOptions = {
  baseUrl?: string
  serviceToken?: string
  fetch?: typeof globalThis.fetch
  contractVersion?: EngineContractVersion
}

function trimBaseUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function serviceHeaders(serviceToken: string | undefined): HeadersInit {
  return serviceToken ? { authorization: `Bearer ${serviceToken}` } : {}
}

export function createEngineClient(
  options: EngineClientOptions = {}
): EngineClient {
  const baseUrl = trimBaseUrl(options.baseUrl ?? process.env.CHAT_ENGINE_URL)
  const serviceToken =
    options.serviceToken ?? process.env.CHAT_ENGINE_SERVICE_TOKEN
  const request = options.fetch ?? globalThis.fetch
  const contractVersion =
    options.contractVersion ?? CHAT_ENGINE_CONTRACT_VERSION

  const requireBaseUrl = () => {
    if (!baseUrl) throw new Error('CHAT_ENGINE_URL is not configured.')
    return baseUrl
  }

  return {
    async manifest(options = {}) {
      const response = await request(
        `${requireBaseUrl()}/${contractVersion}/manifest`,
        {
          headers: serviceHeaders(serviceToken),
          signal: options.signal,
        }
      )
      if (!response.ok) {
        throw new Error(`Engine manifest returned HTTP ${response.status}.`)
      }
      const manifest = parseEngineManifest(
        await response.json(),
        contractVersion
      )
      if (
        contractVersion === 'v2' &&
        response.headers.get(EXPLANATION_WRITER_CAPABILITY_HEADER) === '1'
      )
        return { ...manifest, explanationWriter: true }
      return manifest
    },

    async explanationDraft(input, { providerAuthorization, signal }) {
      if (contractVersion !== 'v2')
        throw new Error('Explanation drafts require a v2 engine.')
      signal.throwIfAborted()
      const body = JSON.stringify(
        engineExplanationDraftRequestSchema.parse(input)
      )
      if (Buffer.byteLength(body) > CHAT_ENGINE_MAX_V2_REQUEST_BYTES)
        throw new Error('Writer request too large.')
      const headers = new Headers({
        ...serviceHeaders(serviceToken),
        'content-type': 'application/json',
      })
      if (providerAuthorization)
        headers.set('provider-authorization', providerAuthorization)
      const response = await request(
        `${requireBaseUrl()}/v2/explanation-draft`,
        {
          method: 'POST',
          redirect: 'error',
          headers,
          body,
          signal,
        }
      )
      if (!response.ok || !response.body) {
        await response.body?.cancel()
        throw new Error(`Explanation engine returned HTTP ${response.status}.`)
      }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let bytes = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES) {
            await reader.cancel()
            throw new Error('Writer response too large.')
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      return engineExplanationDraftResultSchema.parse(
        JSON.parse(Buffer.concat(chunks).toString('utf8'))
      )
    },

    async chat(engineRequest, chatOptions) {
      if (engineRequest.contractVersion !== contractVersion)
        throw new Error(
          'Engine request does not match the selected contract generation.'
        )
      const headers = new Headers({
        ...serviceHeaders(serviceToken),
        'content-type': 'application/json',
      })
      if (chatOptions.providerAuthorization) {
        headers.set('provider-authorization', chatOptions.providerAuthorization)
      }
      if (chatOptions.mcpExecutionToken) {
        headers.set(MCP_EXECUTION_TOKEN_HEADER, chatOptions.mcpExecutionToken)
      }
      if (chatOptions.traceContext) {
        headers.set(TRACEPARENT_HEADER, chatOptions.traceContext.traceparent)
        if (chatOptions.traceContext.tracestate) {
          headers.set(TRACESTATE_HEADER, chatOptions.traceContext.tracestate)
        }
      }
      const response = await request(
        `${requireBaseUrl()}/${contractVersion}/chat`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(engineRequest),
          signal: chatOptions.signal,
        }
      )
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new EngineHttpError(
          response.status,
          detail || 'The selected chat engine rejected the request.'
        )
      }
      if (!response.body) throw new Error('The chat engine returned no stream.')
      return response
    },
  }
}

export class EngineHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'EngineHttpError'
    this.status = status
  }
}

export type EngineReadiness = {
  ok: boolean
  contractVersion: EngineContractVersion
  engineId: string | null
  reason: string | null
  features?: SupportedEngineManifest['features']
  explanationWriter?: true
}

export class EngineReadinessProbe {
  private lastCheckedAt = 0
  private inFlight: Promise<EngineReadiness> | null = null
  private state: EngineReadiness = {
    ok: false,
    contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    engineId: null,
    reason: 'Engine manifest has not been checked.',
  }

  constructor(
    private readonly engine: EngineClient,
    private readonly ttlMs = 15_000,
    private readonly manifestTimeoutMs = 5_000,
    private readonly expectedEngineId = process.env.CHAT_ENGINE_ID,
    private readonly contractVersion: EngineContractVersion = CHAT_ENGINE_CONTRACT_VERSION
  ) {}

  async get(): Promise<EngineReadiness> {
    if (this.inFlight) return this.inFlight
    if (Date.now() - this.lastCheckedAt < this.ttlMs) return this.state
    this.inFlight = this.refresh().finally(() => {
      this.lastCheckedAt = Date.now()
      this.inFlight = null
    })
    return this.inFlight
  }

  private async refresh(): Promise<EngineReadiness> {
    const abortController = new AbortController()
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          abortController.abort()
          reject(new Error('Engine manifest check timed out.'))
        }, this.manifestTimeoutMs)
      })
      const manifest = await Promise.race([
        this.engine.manifest({ signal: abortController.signal }),
        timeout,
      ])
      const compatible =
        manifest.contractVersion === this.contractVersion &&
        Boolean(this.expectedEngineId) &&
        manifest.engineId === this.expectedEngineId
      this.state = {
        ok: compatible,
        contractVersion: manifest.contractVersion,
        engineId: manifest.engineId,
        features: manifest.features,
        ...(manifest.explanationWriter
          ? { explanationWriter: true as const }
          : {}),
        reason: compatible
          ? null
          : 'Engine identity or contract version is incompatible.',
      }
    } catch (error) {
      this.state = {
        ok: false,
        contractVersion: this.contractVersion,
        engineId: null,
        reason: error instanceof Error ? error.message : 'Engine unavailable.',
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
    return this.state
  }
}
