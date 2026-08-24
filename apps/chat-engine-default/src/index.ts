import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import {
  type ApprovedTool,
  CHAT_ENGINE_CONTRACT_VERSION,
  type EngineChatRequest,
  type EngineFinishMetadata,
  type EngineManifest,
  type EngineMessage,
  type EngineUsage,
  engineChatRequestSchema,
  engineManifestSchema,
  MCP_EXECUTION_TOKEN_HEADER,
  parseProviderAllowedOrigins,
  providerOriginIsAllowed,
  type ResolvedGeneration,
  validateProviderCredentialHeaders,
} from '@klicker-uzh/chat-engine-contract'
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  dynamicTool,
  isStepCount,
  type JSONValue,
  jsonSchema,
  type LanguageModel,
  type ModelMessage,
  streamText,
  type ToolResultPart,
  type UIMessage,
  type UIMessageStreamWriter,
} from 'ai'
import { Hono } from 'hono'
import {
  createProviderModel,
  type ProviderConfig,
  providerOptionsForGeneration,
} from './provider.js'

const DEFAULT_ENGINE_ID = 'public-ai-sdk'
const DEFAULT_PORT = 3015

export type ToolExecutionContext = {
  tool: ApprovedTool
  input: unknown
  token: string
  abortSignal: AbortSignal
}

export type DefaultEngineOptions = ProviderConfig & {
  engineId?: string
  serviceToken?: string
  mcpExecutionUrl?: string
  modelFactory?: (
    generation: ResolvedGeneration,
    providerApiKey: string
  ) => LanguageModel
  toolExecutor?: (context: ToolExecutionContext) => Promise<unknown>
}

const DEFAULT_MANIFEST: EngineManifest = engineManifestSchema.parse({
  contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
  engineId: DEFAULT_ENGINE_ID,
  features: {
    text: true,
    reasoning: true,
    images: true,
    tools: true,
    cancellation: true,
  },
  providerCredentialModes: ['gateway', 'deployment'],
  limits: {
    maxMessages: 100,
    maxTools: 64,
    maxImageAttachments: 3,
    maxDecodedImageBytes: 5 * 1024 * 1024,
    maxDataUrlLength: 7_000_000,
  },
})

function jsonError(
  status: number,
  code: string,
  message: string,
  retryable = false
) {
  return new Response(
    JSON.stringify({
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
      error: { code, message, retryable },
    }),
    {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function finiteToken(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null
}

function normalizeUsage(value: unknown): EngineUsage {
  const record = asRecord(value)
  const input = asRecord(record?.inputTokens)
  const output = asRecord(record?.outputTokens)
  const inputTokens =
    finiteToken(record?.inputTokens) ?? finiteToken(input?.total)
  const outputTokens =
    finiteToken(record?.outputTokens) ?? finiteToken(output?.total)
  const reasoningTokens =
    finiteToken(record?.reasoningTokens) ?? finiteToken(output?.reasoning)
  const cacheReadTokens =
    finiteToken(record?.cacheReadTokens) ?? finiteToken(input?.cacheRead)
  const cacheWriteTokens =
    finiteToken(record?.cacheWriteTokens) ?? finiteToken(input?.cacheWrite)
  const totalTokens =
    finiteToken(record?.totalTokens) ??
    (inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null)

  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
  }
}

function sumStepUsage(steps: unknown): EngineUsage {
  if (!Array.isArray(steps)) return normalizeUsage(null)
  const totals = normalizeUsage(null)
  let sawUsage = false
  for (const step of steps) {
    const usage = normalizeUsage(asRecord(step)?.usage)
    const values = [
      'inputTokens',
      'outputTokens',
      'reasoningTokens',
      'cacheReadTokens',
      'cacheWriteTokens',
      'totalTokens',
    ] as const
    if (values.some((key) => usage[key] !== null)) sawUsage = true
    for (const key of values) {
      if (usage[key] !== null) totals[key] = (totals[key] ?? 0) + usage[key]
    }
  }
  return sawUsage ? totals : normalizeUsage(null)
}

function toModelMessages(messages: EngineMessage[]): ModelMessage[] {
  const modelMessages: ModelMessage[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      const content: Array<
        { type: 'text'; text: string } | { type: 'image'; image: string }
      > = []
      for (const part of message.parts) {
        if (part.type === 'text')
          content.push({ type: 'text', text: part.text })
        if (part.type === 'image')
          content.push({ type: 'image', image: part.dataUrl })
      }
      if (content.length > 0) {
        const first = content[0]
        modelMessages.push({
          role: 'user',
          content:
            content.length === 1 && first?.type === 'text'
              ? first.text
              : content,
        })
      }
      continue
    }

    const assistantContent: unknown[] = []
    const toolResults: ToolResultPart[] = []
    for (const part of message.parts) {
      if (part.type === 'text') {
        assistantContent.push({ type: 'text', text: part.text })
      } else if (part.type === 'reasoning') {
        assistantContent.push({ type: 'reasoning', text: part.text })
      } else if (part.type === 'tool-call') {
        assistantContent.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input ?? {},
        })
        if (part.output !== undefined) {
          toolResults.push({
            type: 'tool-result',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: part.isError
              ? { type: 'error-json', value: part.output as JSONValue }
              : { type: 'json', value: part.output as JSONValue },
          })
        }
      }
    }
    if (assistantContent.length > 0) {
      modelMessages.push({
        role: 'assistant',
        content: assistantContent as never,
      })
    }
    if (toolResults.length > 0) {
      modelMessages.push({ role: 'tool', content: toolResults })
    }
  }

  return modelMessages
}

function buildTools(
  tools: ApprovedTool[],
  token: string,
  options: DefaultEngineOptions,
  requestSignal: AbortSignal
) {
  const executeTool =
    options.toolExecutor ??
    (async (context: ToolExecutionContext) => {
      const endpoint = options.mcpExecutionUrl ?? process.env.MCP_EXECUTION_URL
      if (!endpoint) throw new Error('MCP execution is not configured.')
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${context.token}`,
        },
        body: JSON.stringify({
          serverId: context.tool.serverId,
          toolName: context.tool.name,
          input: context.input,
        }),
        signal: context.abortSignal,
      })
      if (!response.ok) {
        throw new Error(`MCP execution failed with HTTP ${response.status}.`)
      }
      return await response.json()
    })

  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      dynamicTool({
        description: tool.description,
        inputSchema: jsonSchema(tool.inputSchema as never),
        execute: (input, executionOptions) =>
          executeTool({
            tool,
            input,
            token,
            abortSignal: executionOptions.abortSignal ?? requestSignal,
          }),
      }),
    ])
  )
}

function finishMetadata(
  request: EngineChatRequest,
  engineId: string,
  usage: EngineUsage,
  reasoningContent: string,
  aborted: boolean
): EngineFinishMetadata {
  return {
    contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    engineId,
    runId: request.runId,
    modelId: request.generation.modelId,
    deploymentId: request.generation.deploymentId,
    usage,
    reasoningContent: reasoningContent || null,
    aborted,
  }
}

function serializeStreamError(error: unknown) {
  const record = asRecord(error)
  const code =
    typeof record?.code === 'string' ? record.code : 'ENGINE_STREAM_ERROR'
  return {
    code: code.slice(0, 128),
    message: 'The selected engine could not complete the request.',
    retryable: false,
  }
}

function serviceAuthorized(request: Request, serviceToken: string | undefined) {
  if (!serviceToken) return false
  return request.headers.get('authorization') === `Bearer ${serviceToken}`
}

type ProviderResolution =
  | { providerApiKey: string }
  | {
      code: 'INVALID_PROVIDER_CREDENTIAL_MODE' | 'PROVIDER_ORIGIN_NOT_ALLOWED'
      error: string
    }

function resolveProviderKey(
  request: Request,
  generation: ResolvedGeneration,
  options: DefaultEngineOptions,
  providerApiKey: string | undefined
): ProviderResolution {
  const credentials = validateProviderCredentialHeaders(
    generation,
    request.headers
  )
  if (!credentials.ok) {
    return {
      code: 'INVALID_PROVIDER_CREDENTIAL_MODE',
      error: credentials.message,
    } as const
  }
  if (generation.credentialMode.mode === 'gateway') {
    if (
      !providerOriginIsAllowed(
        generation.credentialMode.gatewayOrigin,
        options.providerAllowedOrigins ?? new Set()
      )
    ) {
      return {
        code: 'PROVIDER_ORIGIN_NOT_ALLOWED',
        error: 'Gateway origin is not allowed.',
      } as const
    }
    return { providerApiKey: credentials.providerApiKey! } as const
  }
  const key =
    providerApiKey ?? options.deploymentApiKey ?? process.env.OPENAI_API_KEY
  if (!key)
    return {
      code: 'INVALID_PROVIDER_CREDENTIAL_MODE',
      error: 'Deployment provider credential is not configured.',
    } as const
  return { providerApiKey: key } as const
}

export function createDefaultEngineApp(options: DefaultEngineOptions = {}) {
  options.providerAllowedOrigins ??= parseProviderAllowedOrigins(
    process.env.CHAT_ENGINE_PROVIDER_ALLOWED_ORIGINS
  )
  const engineId =
    options.engineId ?? process.env.CHAT_ENGINE_ID ?? DEFAULT_ENGINE_ID
  const serviceToken =
    options.serviceToken ?? process.env.CHAT_ENGINE_SERVICE_TOKEN
  const manifest = { ...DEFAULT_MANIFEST, engineId }
  const app = new Hono()

  app.get('/health', (c) =>
    c.json({
      ok: true,
      engineId,
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    })
  )
  app.get('/v1/manifest', (c) => c.json(manifest))

  app.post('/v1/chat', async (c) => {
    if (!serviceAuthorized(c.req.raw, serviceToken)) {
      return jsonError(
        401,
        'ENGINE_AUTH_REQUIRED',
        'Engine service authentication is required.'
      )
    }

    let request: EngineChatRequest
    try {
      request = engineChatRequestSchema.parse(await c.req.json())
    } catch {
      return jsonError(
        400,
        'INVALID_ENGINE_REQUEST',
        'The engine request is invalid.'
      )
    }

    const provider = resolveProviderKey(
      c.req.raw,
      request.generation,
      options,
      options.modelFactory ? 'model-factory' : undefined
    )
    if ('error' in provider) {
      return jsonError(400, provider.code, provider.error)
    }

    const mcpToken = c.req.header(MCP_EXECUTION_TOKEN_HEADER)
    if (request.tools.length > 0 && !mcpToken) {
      return jsonError(
        400,
        'MCP_TOKEN_REQUIRED',
        'MCP execution token is required when tools are supplied.'
      )
    }

    let model: LanguageModel
    try {
      model = options.modelFactory
        ? options.modelFactory(request.generation, provider.providerApiKey)
        : createProviderModel(
            request.generation,
            provider.providerApiKey,
            options
          )
    } catch {
      return jsonError(
        503,
        'ENGINE_NOT_CONFIGURED',
        'The selected engine is not configured.',
        true
      )
    }

    let reasoningContent = ''
    let writer: UIMessageStreamWriter | undefined
    const tools =
      request.tools.length > 0
        ? buildTools(request.tools, mcpToken!, options, c.req.raw.signal)
        : undefined

    const result = streamText({
      model,
      system: request.systemPrompt,
      messages: toModelMessages(request.messages),
      ...(request.generation.maxOutputTokens
        ? { maxOutputTokens: request.generation.maxOutputTokens }
        : {}),
      providerOptions: providerOptionsForGeneration(request.generation),
      ...(tools
        ? { tools, toolChoice: 'auto' as const, stopWhen: isStepCount(5) }
        : {}),
      maxRetries: 0,
      abortSignal: c.req.raw.signal,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'reasoning-delta') reasoningContent += chunk.text
      },
      onAbort: async (steps) => {
        writer?.write({
          type: 'message-metadata',
          messageMetadata: finishMetadata(
            request,
            engineId,
            sumStepUsage(steps?.steps),
            reasoningContent,
            true
          ),
        })
      },
      onError: () => undefined,
    })

    const stream = createUIMessageStream({
      originalMessages: [
        {
          id: request.assistantMessageId,
          role: 'assistant',
          parts: [],
        },
      ] satisfies UIMessage[],
      generateId: () => request.assistantMessageId,
      execute: ({ writer: streamWriter }) => {
        writer = streamWriter
        streamWriter.merge(
          result.toUIMessageStream({
            originalMessages: [
              {
                id: request.assistantMessageId,
                role: 'assistant',
                parts: [],
              },
            ] satisfies UIMessage[],
            generateMessageId: () => request.assistantMessageId,
            sendReasoning: true,
            messageMetadata: ({ part }) =>
              part.type === 'finish'
                ? finishMetadata(
                    request,
                    engineId,
                    normalizeUsage(part.totalUsage),
                    reasoningContent,
                    false
                  )
                : undefined,
            onError: (error) => {
              const serialized = serializeStreamError(error)
              return JSON.stringify(serialized)
            },
          })
        )
      },
      onError: (error) => JSON.stringify(serializeStreamError(error)),
    })

    return createUIMessageStreamResponse({ stream })
  })

  return app
}

export const app = createDefaultEngineApp()

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT)
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(
      `[chat-engine-default] listening on http://localhost:${info.port}`
    )
  })
}
