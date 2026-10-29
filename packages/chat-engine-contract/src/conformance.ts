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
  transportCancelled: true
}

function endpoint(baseUrl: string, path: string): string {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The conformance engine URL must use HTTP or HTTPS.')
  }
  return new URL(
    path.replace(/^\//, ''),
    `${url.toString().replace(/\/$/, '')}/`
  ).toString()
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
  options: ChatEngineConformanceOptions,
  signal?: AbortSignal
): Promise<Response> {
  const request = options.fetch ?? globalThis.fetch
  return request(endpoint(options.baseUrl, '/v1/chat'), {
    method: 'POST',
    headers: requestHeaders(options),
    body: JSON.stringify(options.request),
    signal,
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

function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Cancellation check exceeded its deadline.')),
      milliseconds
    )
  })
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer))
}

async function verifyTransportCancellation(
  options: ChatEngineConformanceOptions
): Promise<true> {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let failed = false
  let failure: unknown
  const expiresAt = Date.now() + 10000
  const withinDeadline = <T>(operation: Promise<T>) =>
    bounded(operation, Math.max(1, expiresAt - Date.now()))
  try {
    const response = await withinDeadline(sendChat(options, controller.signal))
    reader = response.body?.getReader()
    if (!response.ok)
      throw new Error(`Abort scenario returned HTTP ${response.status}.`)
    if (
      !response.headers.get('content-type')?.includes('text/event-stream') ||
      !reader
    ) {
      throw new Error('Abort scenario returned no SSE stream.')
    }
    const decoder = new TextDecoder()
    let pending = ''
    let admitted = false
    while (!admitted) {
      const chunk = await withinDeadline(reader.read())
      if (chunk.done)
        throw new Error('Abort scenario ended before cancellation.')
      pending += decoder.decode(chunk.value, { stream: true })
      if (pending.length > 65536)
        throw new Error('Abort scenario exceeded the initial event bound.')
      const frames = pending.split(/\r?\n\r?\n/)
      pending = frames.pop() ?? ''
      for (const frame of frames) {
        if (frame.trim() === 'data: [DONE]')
          throw new Error('Abort scenario already completed.')
        if (!frame.startsWith('data: '))
          throw new Error('Abort scenario contained a non-data SSE frame.')
        const part = parseEngineStreamPart(
          JSON.parse(frame.slice('data: '.length))
        )
        if (['finish', 'abort', 'error'].includes(part.type)) {
          throw new Error('Abort scenario already returned a terminal event.')
        }
        admitted = true
      }
    }
    controller.abort()
    let cancelled = false
    try {
      await withinDeadline(reader.read())
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) throw error
      cancelled = true
    }
    if (!cancelled)
      throw new Error('Abort scenario did not cancel its response transport.')
  } catch (error) {
    failed = true
    failure = error
  }
  controller.abort()
  if (reader) {
    try {
      await bounded(reader.cancel(), 1000)
    } catch (error) {
      if (!failed && !(error instanceof Error && error.name === 'AbortError')) {
        failed = true
        failure = error
      }
    } finally {
      try {
        reader.releaseLock()
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
    }
  }
  if (failed) throw failure
  return true
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
    'Gateway credential mode without Provider-Authorization'
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

  const transportCancelled = await verifyTransportCancellation({
    ...shared,
    request: options.abortRequest,
  })

  return {
    manifest: deployment.manifest,
    deploymentStream: deployment.stream,
    requestCredentialStream: requestCredential.stream,
    toolStream,
    transportCancelled,
  }
}
