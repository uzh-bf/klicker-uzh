import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import {
  type ApprovedTool,
  CHAT_ENGINE_CONTRACT_V2,
  CHAT_ENGINE_CONTRACT_VERSION,
  CHAT_ENGINE_MAX_V2_REQUEST_BYTES,
  type SupportedEngineChatRequest as EngineChatRequest,
  type EngineContractVersion,
  type SupportedEngineFinishMetadata as EngineFinishMetadata,
  type EngineManifest,
  type SupportedEngineMessage as EngineMessage,
  type EngineUsage,
  engineChatRequestSchema,
  engineManifestSchema,
  engineToolExecutionV2ResultSchema,
  engineV2ChatRequestSchema,
  engineV2ManifestSchema,
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
  type LanguageModelUsage,
  type ModelMessage,
  type StreamTextTransform,
  streamText,
  type TextStreamPart,
  type ToolResultPart,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
  type UIMessageStreamWriter,
} from 'ai'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
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
  contractVersion: EngineContractVersion
}

export type DefaultEngineOptions = ProviderConfig & {
  engineId?: string
  serviceToken?: string
  mcpExecutionUrl?: string
  modelFactory?: (
    generation: EngineChatRequest['generation'],
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

const DEFAULT_V2_MANIFEST = engineV2ManifestSchema.parse({
  ...DEFAULT_MANIFEST,
  contractVersion: CHAT_ENGINE_CONTRACT_V2,
  features: { ...DEFAULT_MANIFEST.features, modelToolOutputs: true },
  limits: {
    ...DEFAULT_MANIFEST.limits,
    maxDocumentPages: 10,
    maxDocumentPageDataUrlLength: 2_000_000,
    maxRequestBytes: CHAT_ENGINE_MAX_V2_REQUEST_BYTES,
  },
})

function jsonError(
  status: number,
  code: string,
  message: string,
  retryable = false,
  contractVersion: EngineContractVersion = CHAT_ENGINE_CONTRACT_VERSION
) {
  return new Response(
    JSON.stringify({
      contractVersion,
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
    if (
      usage.inputTokens === null ||
      usage.outputTokens === null ||
      usage.totalTokens === null
    )
      continue
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
        if (part.output === undefined) continue
        assistantContent.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input ?? {},
        })
        if (part.output !== undefined) {
          const modelOutput: ToolResultPart['output'] =
            'modelOutput' in part && part.modelOutput !== undefined
              ? (part.modelOutput as ToolResultPart['output'])
              : part.isError
                ? { type: 'error-json', value: part.output as JSONValue }
                : { type: 'json', value: part.output as JSONValue }
          toolResults.push({
            type: 'tool-result',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: modelOutput,
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
  requestSignal: AbortSignal,
  contractVersion: EngineContractVersion
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
          ...(context.contractVersion === CHAT_ENGINE_CONTRACT_V2
            ? { contractVersion: context.contractVersion }
            : {}),
        }),
        signal: context.abortSignal,
      })
      if (!response.ok) {
        throw new Error(`MCP execution failed with HTTP ${response.status}.`)
      }
      return await response.json()
    })

  const modelOutputs = new Map<string, ToolResultPart['output']>()
  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      dynamicTool({
        description: tool.description,
        inputSchema: jsonSchema(tool.inputSchema as never),
        execute: async (input, executionOptions) => {
          const result = await executeTool({
            tool,
            input,
            token,
            abortSignal: executionOptions.abortSignal ?? requestSignal,
            contractVersion,
          })
          if (contractVersion === CHAT_ENGINE_CONTRACT_VERSION) return result
          const { output, modelOutput } =
            engineToolExecutionV2ResultSchema.parse(result)
          if (modelOutput !== undefined)
            modelOutputs.set(
              executionOptions.toolCallId,
              modelOutput as ToolResultPart['output']
            )
          return output
        },
        ...(contractVersion === CHAT_ENGINE_CONTRACT_V2
          ? {
              toModelOutput: ({
                output,
                toolCallId,
              }: {
                output: unknown
                toolCallId: string
              }) => {
                const projection = modelOutputs.get(toolCallId)
                modelOutputs.delete(toolCallId)
                return (
                  projection ?? {
                    type: 'json' as const,
                    value: output as JSONValue,
                  }
                )
              },
            }
          : {}),
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
    contractVersion: request.contractVersion,
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

const MAX_HELD_TEXT_LENGTH = 120

/**
 * A step that returned text while reporting no input and no output tokens
 * never reached the model: inference always reads the prompt. A provider or
 * gateway safety layer answers some requests this way, with a generic
 * refusal sentence, before the mode instructions apply.
 */
export function isUnbilledProviderReply(usage: LanguageModelUsage): boolean {
  return (
    !(usage.inputTokens && usage.inputTokens > 0) &&
    !(usage.outputTokens && usage.outputTokens > 0)
  )
}

/**
 * Replaces a step's text with `deflection` when the step turns out to be an
 * unbilled provider reply, so a chat mode never shows the provider's generic
 * refusal and a persona never breaks role. Only a step's text is held, and
 * only until the step finishes, the model streams reasoning or calls a tool,
 * or the held text exceeds a canned sentence; each of those proves a genuine
 * answer and releases the text unchanged. Other parts pass through at once.
 */
export function providerRefusalTransform<TOOLS extends ToolSet>(
  deflection: string,
  onSubstitute?: (finish: {
    finishReason: string
    rawFinishReason: string | undefined
  }) => void
): StreamTextTransform<TOOLS> {
  return () => {
    let held: TextStreamPart<TOOLS>[] | null = null
    let heldTextLength = 0

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === 'start-step') {
          held = []
          heldTextLength = 0
          controller.enqueue(part)
          return
        }
        if (held === null) {
          controller.enqueue(part)
          return
        }

        if (part.type === 'finish-step') {
          const parts = held
          held = null
          const hasText = parts.some(
            (p) => p.type === 'text-delta' && p.text.length > 0
          )
          if (hasText && isUnbilledProviderReply(part.usage)) {
            onSubstitute?.({
              finishReason: part.finishReason,
              rawFinishReason: part.rawFinishReason,
            })
            let replaced = false
            for (const p of parts) {
              if (p.type !== 'text-delta') {
                controller.enqueue(p)
              } else if (!replaced) {
                replaced = true
                controller.enqueue({ ...p, text: deflection })
              }
            }
          } else {
            for (const p of parts) controller.enqueue(p)
          }
          controller.enqueue(part)
          return
        }

        const isText =
          part.type === 'text-start' ||
          part.type === 'text-delta' ||
          part.type === 'text-end'
        if (!isText) {
          const provesGenuineAnswer =
            (part.type === 'reasoning-delta' && part.text.length > 0) ||
            part.type === 'tool-input-start' ||
            part.type === 'tool-call'
          if (provesGenuineAnswer) {
            for (const p of held) controller.enqueue(p)
            held = null
          }
          controller.enqueue(part)
          return
        }

        held.push(part)
        if (part.type === 'text-delta') heldTextLength += part.text.length
        if (heldTextLength > MAX_HELD_TEXT_LENGTH) {
          for (const p of held) controller.enqueue(p)
          held = null
        }
      },
      flush(controller) {
        if (held) for (const p of held) controller.enqueue(p)
      },
    })
  }
}

export function createDefaultEngineApp(options: DefaultEngineOptions = {}) {
  options.deploymentBaseUrl ??= process.env.OPENAI_BASE_URL
  options.providerAllowedOrigins ??= parseProviderAllowedOrigins(
    process.env.CHAT_ENGINE_PROVIDER_ALLOWED_ORIGINS
  )
  const engineId =
    options.engineId ?? process.env.CHAT_ENGINE_ID ?? DEFAULT_ENGINE_ID
  const serviceToken =
    options.serviceToken ?? process.env.CHAT_ENGINE_SERVICE_TOKEN
  const app = new Hono()

  app.get('/health', (c) =>
    c.json({
      ok: true,
      engineId,
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    })
  )
  app.use('/v2/chat', async (c, next) => {
    if (!serviceAuthorized(c.req.raw, serviceToken)) {
      return jsonError(
        401,
        'ENGINE_AUTH_REQUIRED',
        'Engine service authentication is required.',
        false,
        CHAT_ENGINE_CONTRACT_V2
      )
    }
    await next()
  })
  app.use(
    '/v2/chat',
    bodyLimit({
      maxSize: CHAT_ENGINE_MAX_V2_REQUEST_BYTES,
      onError: () =>
        jsonError(
          413,
          'ENGINE_REQUEST_TOO_LARGE',
          'The engine request exceeds its byte limit.',
          false,
          CHAT_ENGINE_CONTRACT_V2
        ),
    })
  )

  for (const version of [
    CHAT_ENGINE_CONTRACT_VERSION,
    CHAT_ENGINE_CONTRACT_V2,
  ]) {
    const manifest = {
      ...(version === CHAT_ENGINE_CONTRACT_VERSION
        ? DEFAULT_MANIFEST
        : DEFAULT_V2_MANIFEST),
      engineId,
    }
    const fail = (
      status: number,
      code: string,
      message: string,
      retryable = false
    ) => jsonError(status, code, message, retryable, version)
    app.get(`/${version}/manifest`, (c) => c.json(manifest))
    app.post(`/${version}/chat`, async (c) => {
      if (!serviceAuthorized(c.req.raw, serviceToken)) {
        return fail(
          401,
          'ENGINE_AUTH_REQUIRED',
          'Engine service authentication is required.'
        )
      }

      let request: EngineChatRequest
      try {
        request = (
          version === CHAT_ENGINE_CONTRACT_VERSION
            ? engineChatRequestSchema
            : engineV2ChatRequestSchema
        ).parse(await c.req.json())
      } catch {
        return fail(
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
        return fail(400, provider.code, provider.error)
      }

      const mcpToken = c.req.header(MCP_EXECUTION_TOKEN_HEADER)
      if (request.tools.length > 0 && !mcpToken) {
        return fail(
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
        return fail(
          503,
          'ENGINE_NOT_CONFIGURED',
          'The selected engine is not configured.',
          true
        )
      }

      let reasoningContent = ''
      let writer: UIMessageStreamWriter | undefined
      const completedCalls: Array<{ usage: unknown }> = []
      const tools =
        request.tools.length > 0
          ? buildTools(
              request.tools,
              mcpToken!,
              options,
              c.req.raw.signal,
              request.contractVersion
            )
          : undefined

      const result = streamText({
        model,
        system: request.systemPrompt,
        messages: toModelMessages(request.messages),
        ...('stepPolicy' in request && request.stepPolicy
          ? {
              allowSystemInMessages: true,
              prepareStep: ({
                stepNumber,
                initialMessages,
                responseMessages,
              }) => ({
                toolChoice:
                  stepNumber === 0 && request.stepPolicy?.firstToolName
                    ? {
                        type: 'tool' as const,
                        toolName: request.stepPolicy.firstToolName,
                      }
                    : ('auto' as const),
                messages: [
                  ...initialMessages,
                  ...responseMessages,
                  {
                    role: 'system' as const,
                    content: request.stepPolicy!.trailingSystemMessage,
                  },
                ],
              }),
            }
          : {}),
        ...(request.generation.maxOutputTokens
          ? { maxOutputTokens: request.generation.maxOutputTokens }
          : {}),
        providerOptions: providerOptionsForGeneration(request.generation),
        ...(tools
          ? { tools, toolChoice: 'auto' as const, stopWhen: isStepCount(5) }
          : {}),
        ...('stepPolicy' in request &&
        request.stepPolicy?.unbilledReplyReplacement !== undefined
          ? {
              experimental_transform: providerRefusalTransform(
                request.stepPolicy.unbilledReplyReplacement
              ),
            }
          : {}),
        maxRetries: 0,
        abortSignal: c.req.raw.signal,
        onChunk: ({ chunk }) => {
          if (chunk.type === 'reasoning-delta') reasoningContent += chunk.text
        },
        onLanguageModelCallEnd: (call) => {
          completedCalls.push({ usage: call.usage })
          writer?.write({
            type: 'message-metadata',
            messageMetadata: finishMetadata(
              request,
              engineId,
              sumStepUsage(completedCalls),
              reasoningContent,
              false
            ),
          })
        },
        onAbort: async (steps) => {
          writer?.write({
            type: 'message-metadata',
            messageMetadata: finishMetadata(
              request,
              engineId,
              sumStepUsage(
                steps?.steps && steps.steps.length >= completedCalls.length
                  ? steps.steps
                  : completedCalls
              ),
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
          const startedToolInputs = new Set<string>()
          streamWriter.merge(
            result
              .toUIMessageStream({
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
              .pipeThrough(
                new TransformStream<UIMessageChunk, UIMessageChunk>({
                  transform(part, controller) {
                    if (part.type === 'tool-input-start')
                      startedToolInputs.add(part.toolCallId)
                    // Providers can return complete calls without streaming arguments.
                    // Atomic calls still need the platform contract's start event.
                    if (
                      (part.type === 'tool-input-available' ||
                        part.type === 'tool-input-error') &&
                      !startedToolInputs.has(part.toolCallId)
                    ) {
                      startedToolInputs.add(part.toolCallId)
                      controller.enqueue({
                        type: 'tool-input-start',
                        toolCallId: part.toolCallId,
                        toolName: part.toolName,
                      })
                    }
                    controller.enqueue(part)
                  },
                })
              )
          )
        },
        onError: (error) => JSON.stringify(serializeStreamError(error)),
      })

      return createUIMessageStreamResponse({ stream })
    })
  }

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
