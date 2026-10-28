import {
  CHAT_ENGINE_CONTRACT_VERSION,
  MCP_EXECUTION_TOKEN_HEADER,
  TRACEPARENT_HEADER,
  TRACESTATE_HEADER,
  parseEngineManifest,
  type EngineChatRequest,
  type EngineManifest,
} from '@klicker-uzh/chat-engine-contract'

export type EngineClient = {
  manifest(options?: { signal?: AbortSignal }): Promise<EngineManifest>
  chat(
    request: EngineChatRequest,
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

  const requireBaseUrl = () => {
    if (!baseUrl) throw new Error('CHAT_ENGINE_URL is not configured.')
    return baseUrl
  }

  return {
    async manifest(options = {}) {
      const response = await request(`${requireBaseUrl()}/v1/manifest`, {
        headers: serviceHeaders(serviceToken),
        signal: options.signal,
      })
      if (!response.ok) {
        throw new Error(`Engine manifest returned HTTP ${response.status}.`)
      }
      return parseEngineManifest(await response.json())
    },

    async chat(engineRequest, chatOptions) {
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
      const response = await request(`${requireBaseUrl()}/v1/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(engineRequest),
        signal: chatOptions.signal,
      })
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
  contractVersion: typeof CHAT_ENGINE_CONTRACT_VERSION
  engineId: string | null
  reason: string | null
  features?: EngineManifest['features']
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
    private readonly expectedEngineId = process.env.CHAT_ENGINE_ID
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
        manifest.contractVersion === CHAT_ENGINE_CONTRACT_VERSION &&
        Boolean(this.expectedEngineId) &&
        manifest.engineId === this.expectedEngineId
      this.state = {
        ok: compatible,
        contractVersion: manifest.contractVersion,
        engineId: manifest.engineId,
        features: manifest.features,
        reason: compatible
          ? null
          : 'Engine identity or contract version is incompatible.',
      }
    } catch (error) {
      this.state = {
        ok: false,
        contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
        engineId: null,
        reason: error instanceof Error ? error.message : 'Engine unavailable.',
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
    return this.state
  }
}
