import {
  CHAT_ENGINE_CONTRACT_VERSION,
  parseEngineManifest,
  type EngineChatRequest,
  type EngineManifest,
} from '@klicker-uzh/chat-engine-contract'

export type EngineClient = {
  manifest(): Promise<EngineManifest>
  chat(
    request: EngineChatRequest,
    options: {
      providerAuthorization?: string
      mcpExecutionToken?: string
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
    async manifest() {
      const response = await request(`${requireBaseUrl()}/v1/manifest`, {
        headers: serviceHeaders(serviceToken),
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
        headers.set('x-mcp-execution-token', chatOptions.mcpExecutionToken)
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
}

export class EngineReadinessProbe {
  private lastCheckedAt = 0
  private state: EngineReadiness = {
    ok: false,
    contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    engineId: null,
    reason: 'Engine manifest has not been checked.',
  }

  constructor(
    private readonly engine: EngineClient,
    private readonly ttlMs = 15_000
  ) {}

  async get(): Promise<EngineReadiness> {
    if (Date.now() - this.lastCheckedAt < this.ttlMs) return this.state
    this.lastCheckedAt = Date.now()
    try {
      const manifest = await this.engine.manifest()
      this.state = {
        ok: manifest.contractVersion === CHAT_ENGINE_CONTRACT_VERSION,
        contractVersion: manifest.contractVersion,
        engineId: manifest.engineId,
        reason:
          manifest.contractVersion === CHAT_ENGINE_CONTRACT_VERSION
            ? null
            : 'Engine contract version is incompatible.',
      }
    } catch (error) {
      this.state = {
        ok: false,
        contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
        engineId: null,
        reason: error instanceof Error ? error.message : 'Engine unavailable.',
      }
    }
    return this.state
  }
}
