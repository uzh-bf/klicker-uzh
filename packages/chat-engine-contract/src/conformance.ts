import {
  CHAT_ENGINE_CONTRACT_VERSION,
  MCP_EXECUTION_TOKEN_HEADER,
  TRACEPARENT_HEADER,
  TRACESTATE_HEADER,
  engineManifestSchema,
  parseEngineStreamPart,
  type EngineChatRequest,
  type EngineManifest,
  type EngineStreamPart,
} from './schema.js'

export type ChatEngineConformanceOptions = {
  baseUrl: string
  serviceToken: string
  request: EngineChatRequest
  providerAuthorization?: string
  mcpExecutionToken?: string
  traceparent?: string
  tracestate?: string
  fetch?: typeof globalThis.fetch
}

export type ChatEngineConformanceResult = {
  manifest: EngineManifest
  stream: EngineStreamPart[]
}

function endpoint(baseUrl: string, path: string): string {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The conformance engine URL must use HTTP or HTTPS.')
  }
  return new URL(path, `${url.toString().replace(/\/$/, '')}/`).toString()
}

async function readStream(response: Response): Promise<EngineStreamPart[]> {
  const text = await response.text()
  const frames = text.split(/\r?\n\r?\n/).filter(Boolean)
  if (frames.at(-1)?.trim() !== 'data: [DONE]') {
    throw new Error('The engine stream did not end with [DONE].')
  }

  const parts = frames.slice(0, -1).map((frame) => {
    const line = frame.trim()
    if (!line.startsWith('data: ')) {
      throw new Error('The engine stream contained a non-data SSE frame.')
    }
    return parseEngineStreamPart(JSON.parse(line.slice('data: '.length)))
  })
  const terminals = parts.filter((part) =>
    ['finish', 'abort', 'error'].includes(part.type)
  )
  if (terminals.length !== 1 || terminals[0]?.type !== 'finish') {
    throw new Error('The successful engine stream must end with one finish.')
  }
  return parts
}

export async function runChatEngineConformance(
  options: ChatEngineConformanceOptions
): Promise<ChatEngineConformanceResult> {
  const request = options.fetch ?? globalThis.fetch
  const manifestResponse = await request(
    endpoint(options.baseUrl, '/v1/manifest')
  )
  if (!manifestResponse.ok) {
    throw new Error(`Engine manifest returned HTTP ${manifestResponse.status}.`)
  }
  const manifest = engineManifestSchema.parse(await manifestResponse.json())

  const unauthenticated = await request(endpoint(options.baseUrl, '/v1/chat'), {
    method: 'POST',
  })
  if (unauthenticated.status !== 401) {
    throw new Error('The engine accepted an unauthenticated chat request.')
  }

  const headers = new Headers({
    authorization: `Bearer ${options.serviceToken}`,
    'content-type': 'application/json',
  })
  if (options.providerAuthorization) {
    headers.set('provider-authorization', options.providerAuthorization)
  }
  if (options.mcpExecutionToken) {
    headers.set(MCP_EXECUTION_TOKEN_HEADER, options.mcpExecutionToken)
  }
  if (options.traceparent) headers.set(TRACEPARENT_HEADER, options.traceparent)
  if (options.tracestate) headers.set(TRACESTATE_HEADER, options.tracestate)

  const chatResponse = await request(endpoint(options.baseUrl, '/v1/chat'), {
    method: 'POST',
    headers,
    body: JSON.stringify(options.request),
  })
  if (!chatResponse.ok) {
    throw new Error(`Engine chat returned HTTP ${chatResponse.status}.`)
  }
  if (
    !chatResponse.headers.get('content-type')?.includes('text/event-stream')
  ) {
    throw new Error('The engine chat response is not an SSE stream.')
  }
  const stream = await readStream(chatResponse)
  const finish = stream.at(-1)
  if (
    finish?.type !== 'finish' ||
    finish.messageMetadata.contractVersion !== CHAT_ENGINE_CONTRACT_VERSION ||
    finish.messageMetadata.runId !== options.request.runId ||
    finish.messageMetadata.modelId !== options.request.generation.modelId ||
    finish.messageMetadata.deploymentId !==
      options.request.generation.deploymentId
  ) {
    throw new Error('The engine returned mismatched terminal metadata.')
  }

  return { manifest, stream }
}
