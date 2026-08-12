import {
  CHAT_ENGINE_CONTRACT_VERSION,
  type EngineChatRequest,
  type EngineManifest,
  type EngineStreamPart,
  engineManifestSchema,
  MCP_EXECUTION_TOKEN_HEADER,
  parseEngineStreamPart,
  TRACEPARENT_HEADER,
  TRACESTATE_HEADER,
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

export type ChatEngineConformanceSuiteOptions = Pick<
  ChatEngineConformanceOptions,
  'baseUrl' | 'serviceToken' | 'fetch'
> & {
  traceparent: string
  tracestate: string
  deploymentRequest: EngineChatRequest
  requestCredentialRequest: EngineChatRequest
  requestProviderAuthorization: string
  toolRequest: EngineChatRequest
  mcpExecutionToken: string
  abortRequest: EngineChatRequest
}

export type ChatEngineConformanceSuiteResult = {
  manifest: EngineManifest
  deploymentStream: EngineStreamPart[]
  requestCredentialStream: EngineStreamPart[]
  toolStream: EngineStreamPart[]
  abortStream: EngineStreamPart[]
}

function endpoint(baseUrl: string, path: string): string {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The conformance engine URL must use HTTP or HTTPS.')
  }
  return new URL(path, `${url.toString().replace(/\/$/, '')}/`).toString()
}

async function readStream(
  response: Response,
  expectedTerminal: 'finish' | 'abort'
): Promise<EngineStreamPart[]> {
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
  if (terminals.length !== 1 || terminals[0]?.type !== expectedTerminal) {
    throw new Error(
      `The engine stream must end with exactly one ${expectedTerminal}.`
    )
  }
  return parts
}

function requestHeaders(
  options: Pick<
    ChatEngineConformanceOptions,
    | 'serviceToken'
    | 'providerAuthorization'
    | 'mcpExecutionToken'
    | 'traceparent'
    | 'tracestate'
  >
): Headers {
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
  return headers
}

async function sendChat(
  options: ChatEngineConformanceOptions
): Promise<Response> {
  const request = options.fetch ?? globalThis.fetch
  return request(endpoint(options.baseUrl, '/v1/chat'), {
    method: 'POST',
    headers: requestHeaders(options),
    body: JSON.stringify(options.request),
  })
}

function assertTerminalIdentity(
  stream: EngineStreamPart[],
  request: EngineChatRequest,
  expectedTerminal: 'finish' | 'abort'
): void {
  const metadataPart =
    expectedTerminal === 'finish'
      ? stream.at(-1)
      : [...stream].reverse().find((part) => part.type === 'message-metadata')
  const metadata =
    metadataPart?.type === 'finish' || metadataPart?.type === 'message-metadata'
      ? metadataPart.messageMetadata
      : null
  if (
    !metadata ||
    metadata.contractVersion !== CHAT_ENGINE_CONTRACT_VERSION ||
    metadata.runId !== request.runId ||
    metadata.modelId !== request.generation.modelId ||
    metadata.deploymentId !== request.generation.deploymentId ||
    metadata.aborted !== (expectedTerminal === 'abort')
  ) {
    throw new Error('The engine returned mismatched terminal metadata.')
  }
}

async function expectRejected(
  options: ChatEngineConformanceOptions,
  expectedStatus: number,
  label: string
): Promise<void> {
  const response = await sendChat(options)
  if (response.status !== expectedStatus) {
    throw new Error(
      `${label} returned HTTP ${response.status}; expected ${expectedStatus}.`
    )
  }
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

  const chatResponse = await sendChat(options)
  if (!chatResponse.ok) {
    throw new Error(`Engine chat returned HTTP ${chatResponse.status}.`)
  }
  if (
    !chatResponse.headers.get('content-type')?.includes('text/event-stream')
  ) {
    throw new Error('The engine chat response is not an SSE stream.')
  }
  const stream = await readStream(chatResponse, 'finish')
  assertTerminalIdentity(stream, options.request, 'finish')

  return { manifest, stream }
}

export async function runChatEngineConformanceSuite(
  options: ChatEngineConformanceSuiteOptions
): Promise<ChatEngineConformanceSuiteResult> {
  const shared = {
    baseUrl: options.baseUrl,
    serviceToken: options.serviceToken,
    traceparent: options.traceparent,
    tracestate: options.tracestate,
    fetch: options.fetch,
  }
  const deployment = await runChatEngineConformance({
    ...shared,
    request: options.deploymentRequest,
  })
  await expectRejected(
    {
      ...shared,
      request: options.deploymentRequest,
      providerAuthorization: options.requestProviderAuthorization,
    },
    400,
    'Deployment mode with Provider-Authorization'
  )
  await expectRejected(
    { ...shared, request: options.requestCredentialRequest },
    400,
    'Request credential mode without Provider-Authorization'
  )
  const requestCredential = await runChatEngineConformance({
    ...shared,
    request: options.requestCredentialRequest,
    providerAuthorization: options.requestProviderAuthorization,
  })
  await expectRejected(
    { ...shared, request: options.toolRequest },
    400,
    'Tool request without MCP execution token'
  )
  const toolResponse = await sendChat({
    ...shared,
    request: options.toolRequest,
    mcpExecutionToken: options.mcpExecutionToken,
  })
  if (!toolResponse.ok) {
    throw new Error(`Tool request returned HTTP ${toolResponse.status}.`)
  }
  const toolStream = await readStream(toolResponse, 'finish')
  assertTerminalIdentity(toolStream, options.toolRequest, 'finish')
  const approvedNames = new Set(
    options.toolRequest.tools.map((tool) => tool.name)
  )
  const observedToolNames = toolStream.flatMap((part) =>
    'toolName' in part && typeof part.toolName === 'string'
      ? [part.toolName]
      : []
  )
  if (
    observedToolNames.length === 0 ||
    observedToolNames.some((name) => !approvedNames.has(name)) ||
    !toolStream.some((part) => part.type === 'tool-output-available')
  ) {
    throw new Error('The tool stream did not execute an approved tool.')
  }

  const abortResponse = await sendChat({
    ...shared,
    request: options.abortRequest,
  })
  if (!abortResponse.ok) {
    throw new Error(`Abort scenario returned HTTP ${abortResponse.status}.`)
  }
  const abortStream = await readStream(abortResponse, 'abort')
  assertTerminalIdentity(abortStream, options.abortRequest, 'abort')

  return {
    manifest: deployment.manifest,
    deploymentStream: deployment.stream,
    requestCredentialStream: requestCredential.stream,
    toolStream,
    abortStream,
  }
}
