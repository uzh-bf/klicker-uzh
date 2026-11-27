import { randomBytes } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import {
  approvedToolSchema,
  CHAT_ENGINE_CONTRACT_V2,
  CHAT_ENGINE_MAX_V2_DISPATCHER_CACHE_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_CACHE_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_PROJECTION_BYTES,
  CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES,
  type EngineToolExecutionV2Request,
  type EngineToolExecutionV2Result,
  type EngineToolProjectionV2Result,
  type EngineV2ChatRequest,
  type EngineV2Message,
  chatToolStepBudget,
  engineToolExecutionV2RequestSchema,
  engineToolExecutionV2ResultSchema,
  engineToolProjectionV2RequestSchema,
  engineToolProjectionV2ResultSchema,
  SHOW_EXPLANATION_TOOL_NAME,
} from '@klicker-uzh/chat-engine-contract'
import { prisma } from '@klicker-uzh/prisma'
import { asSchema, type ModelMessage, type ToolSet, tool } from 'ai'
import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { z } from 'zod'
import { withCalculatorTool } from '../host/lib/server/calculatorTool.js'
import type { AuthMode } from '../host/lib/server/chatGuestToken.js'
import { withModelCitationIndices } from '../host/lib/server/citationInstructions.js'
import { readCourseImagePreview } from '../host/lib/server/courseImagePreviewStore.js'
import { courseImageStoreConfigured } from '../host/lib/server/courseImageStore.js'
import {
  canRegisterCourseImageTool,
  withCourseImageTool,
} from '../host/lib/server/courseImageTools.js'
import {
  courseImageVisionEnabled,
  createCourseImageVision,
} from '../host/lib/server/courseImageVision.js'
import { resolveEffectiveMCPConfigurations } from '../host/lib/server/effectiveChatModes.js'
import { isChatbotInteractiveExplanationsEnabled } from '../host/lib/server/featureFlags.js'
import { RequiredMCPUnavailableError } from '../host/lib/server/mcpRuntimePolicy.js'
import {
  createResponseExampleSearchTool,
  loadResponseExampleRuntimeSkill,
  RESPONSE_EXAMPLE_SEARCH_TOOL_NAME,
} from '../host/lib/server/responseExampleRuntime.js'
import {
  readVideoFrame,
  videoFrameStoreConfigured,
} from '../host/lib/server/videoFrameStore.js'
import { withVideoFrameTool } from '../host/lib/server/videoFrameTools.js'
import {
  createHostExplanationTool,
  type ExplanationWriter,
  type ExplanationWriterUsage,
  shouldOfferExplanationTool,
} from '../host/services/explainerService.js'
import {
  createHostFeedbackTool,
  isFeedbackToolEnabled,
} from '../host/services/feedbackTool.js'
import { SHOW_FEEDBACK_TOOL_NAME } from '../host/lib/feedback.js'
import { getAggregatedMCPTools } from '../host/services/mcpClients.js'
import { resolveMcpScope } from '../host/services/mcpScope.js'
import {
  formatPracticeCandidatesForPrompt,
  getPracticeStackForQuiz,
  getStudentPracticeMcpUrl,
  lookupRelevantPracticeStacks,
  STUDENT_PRACTICE_QUIZ_TOOL_NAME,
  toPracticeCandidateId,
} from '../host/services/studentPracticeMcp.js'
import type { ToolAuthorization } from './codeapi.js'
import type { ChatbotRecord } from './defaultDependencies.js'

export type HostToolInput = {
  chatbot: ChatbotRecord
  mode: string
  participantId: string
  authMode: AuthMode
  runId: string
  threadId: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  isElearningThread: boolean
  supportsImageAttachments?: boolean
  /** Reads the explanation writer once the turn's model options are known. */
  getExplanationWriter?: () => ExplanationWriter | null
  /** Receives the writer's tokens per finished draft step. */
  onExplanationUsage?: (usage: ExplanationWriterUsage) => void
}

export type HostToolSet = {
  tools: ToolSet
  promptContext: string
  close: () => Promise<void>
  promptToolNames: string[]
  courseImageVision?: ReturnType<typeof createCourseImageVision>
}

export async function prepareHostTools(
  input: HostToolInput
): Promise<HostToolSet> {
  const configurations = input.chatbot.mcpConfigurations
  const selected = resolveEffectiveMCPConfigurations(configurations, input.mode)
  const kbIds = resolveMcpScope(
    configurations.filter((configuration) => configuration.isEnabled !== false),
    input.mode,
    selected
  )
  const scopedKbIds = kbIds ?? []
  let handle: Awaited<ReturnType<typeof getAggregatedMCPTools>> = {
    tools: {},
    close: async () => undefined,
  }
  try {
    try {
      handle = await getAggregatedMCPTools(
        selected.map((configuration) => {
          const server = configuration.mcpServer
          if (!server) throw new RequiredMCPUnavailableError()
          return {
            server: {
              ...server,
              authSecret: server.authSecret ?? undefined,
              chatbotIdHeader: server.chatbotIdHeader ?? undefined,
            },
            config: {
              allowedTools: Array.isArray(configuration.allowedTools)
                ? (configuration.allowedTools as string[])
                : undefined,
              parameters: configuration.parameters,
              priority: configuration.priority ?? 0,
            },
          }
        }),
        {
          chatbotId: input.chatbot.id,
          participantId: input.participantId,
          authMode: input.authMode,
          courseId: input.chatbot.courseId,
          kbIds,
          sessionId: input.threadId,
          knowledgeGraphRetrievalEnabled:
            input.chatbot.knowledgeGraphRetrievalEnabled,
        }
      )
    } catch (error) {
      if (
        !(error instanceof RequiredMCPUnavailableError) ||
        !input.isElearningThread ||
        error.reason !== 'unavailable'
      )
        throw error
      await handle.close()
    }
    let tools: ToolSet = { ...handle.tools }
    if (scopedKbIds.length && videoFrameStoreConfigured()) {
      tools = withVideoFrameTool(tools, scopedKbIds, readVideoFrame)
    }
    const promptContext: string[] = []
    try {
      const skill = await loadResponseExampleRuntimeSkill({
        prisma,
        chatbotId: input.chatbot.id,
        chatMode: input.mode,
        role: 'included',
      })
      if (!Object.hasOwn(tools, RESPONSE_EXAMPLE_SEARCH_TOOL_NAME)) {
        tools[RESPONSE_EXAMPLE_SEARCH_TOOL_NAME] =
          createResponseExampleSearchTool(skill)
        promptContext.push(skill.summary)
      }
    } catch {
      // Response examples are optional guidance; their outage does not remove course tools.
    }
    if (input.mode === 'tutor' && getStudentPracticeMcpUrl() !== null) {
      const candidates = new Map<string, string>()
      try {
        const lookup = await lookupRelevantPracticeStacks({
          authMode: input.authMode,
          chatbotId: input.chatbot.id,
          courseId: input.chatbot.courseId,
          participantId: input.participantId,
          messages: input.messages,
        })
        const items = lookup?.candidates ?? []
        items.forEach((candidate, index) => {
          candidates.set(toPracticeCandidateId(index), candidate.questionRef)
        })
        promptContext.push(formatPracticeCandidatesForPrompt(items))
      } catch {
        // The answer remains available when optional practice lookup is unavailable.
      }
      tools[STUDENT_PRACTICE_QUIZ_TOOL_NAME] = tool({
        description:
          'Show a practice question selected from this turn’s approved candidates.',
        inputSchema: z.object({ candidateId: z.string().min(1) }),
        execute: async ({ candidateId }) => {
          const questionRef = candidates.get(candidateId)
          if (!questionRef)
            return {
              kind: 'student-practice-unavailable' as const,
              reason:
                candidates.size === 0 ? 'no-candidates' : 'unknown-candidate',
            }
          const payload = await getPracticeStackForQuiz({
            authMode: input.authMode,
            chatbotId: input.chatbot.id,
            participantId: input.participantId,
            questionRef,
          })
          if (!payload) throw new Error('Student practice is unavailable')
          return { kind: 'student-practice-quiz' as const, ...payload }
        },
        toModelOutput: ({ output }) => ({
          type: 'text',
          value:
            output.kind === 'student-practice-quiz'
              ? 'A practice quiz was shown. Wait for the student answer before giving feedback.'
              : 'No practice quiz was shown. Continue without a quiz.',
        }),
      })
    }
    const imageDecisionEnabled =
      courseImageStoreConfigured() &&
      canRegisterCourseImageTool(tools, scopedKbIds)
    const imageVisionEnabled =
      imageDecisionEnabled &&
      courseImageVisionEnabled(input.supportsImageAttachments === true)
    const courseImageVision = imageVisionEnabled
      ? createCourseImageVision({
          kbIds: scopedKbIds,
          readImage: (image) => readCourseImagePreview(image, scopedKbIds),
        })
      : undefined
    if (imageDecisionEnabled) {
      tools = withCourseImageTool(
        tools,
        scopedKbIds,
        (image) => readCourseImagePreview(image, scopedKbIds),
        imageVisionEnabled,
        courseImageVision?.hasPixelInput
      )
    }
    const promptToolNames = Object.keys(tools)
    if (
      await shouldOfferExplanationTool({
        chatMode: input.mode,
        chatbotSettingEnabled: input.chatbot.interactiveExplanationsEnabled,
        isOwnerFlagEnabled: () =>
          isChatbotInteractiveExplanationsEnabled(input.chatbot.ownerId),
      })
    ) {
      try {
        const writer = input.getExplanationWriter?.()
        if (writer) {
          const { definition, instructions } = await createHostExplanationTool({
            getWriter: () => writer,
            onUsage: input.onExplanationUsage ?? (() => undefined),
          })
          tools = { ...tools, [SHOW_EXPLANATION_TOOL_NAME]: definition }
          promptContext.push(instructions)
        }
      } catch {
        // A schema outage keeps optional explanations off for this turn.
      }
    }
    // Structured feedback cards quote the learner's own messages, so the tool
    // is fixed to the turn's user messages.
    const learnerMessages = input.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
    const modelTools = { ...withCalculatorTool(input.mode, tools) }
    if (isFeedbackToolEnabled(input.mode)) {
      const feedback = createHostFeedbackTool(learnerMessages)
      modelTools[SHOW_FEEDBACK_TOOL_NAME] = feedback.definition
      promptContext.push(feedback.instructions)
    }
    return {
      courseImageVision,
      tools: modelTools,
      promptToolNames,
      promptContext: promptContext.join('\n\n'),
      close: handle.close,
    }
  } catch (error) {
    await handle.close()
    throw error
  }
}

export type HostToolSession = {
  tools: EngineV2ChatRequest['tools']
  executionToken: string
  close: () => Promise<void>
}

/** Progress chunks a tool streams while it is still working. */
const PENDING_TOOL_OUTPUT_KINDS = new Set(['explanation-pending'])

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
      'function'
  )
}

/**
 * A host tool may stream progress chunks and end with its result, as the
 * explanation tool does while its writer drafts. The model sees only the final
 * value; aborting the call stops the producer through the same signal.
 */
async function toolResultValue(
  output: unknown,
  signal: AbortSignal
): Promise<unknown> {
  if (!isAsyncIterable(output)) return output
  const iterator = output[Symbol.asyncIterator]()
  let final: unknown
  let pending = false
  try {
    for (;;) {
      signal.throwIfAborted()
      const next = await iterator.next()
      signal.throwIfAborted()
      if (next.done) break
      final = next.value
      pending =
        typeof final === 'object' &&
        final !== null &&
        PENDING_TOOL_OUTPUT_KINDS.has((final as { kind?: string }).kind ?? '')
    }
  } catch (error) {
    await iterator.return?.().catch(() => undefined)
    throw error
  }
  // A stream that stops while still working leaves no result to show.
  return pending ? { kind: 'explanation-unavailable' } : final
}

type Session = {
  expiresAt: number
  close: () => Promise<void>
  execute: (
    body: unknown,
    signal: AbortSignal
  ) => Promise<EngineToolExecutionV2Result>
  project: (
    body: unknown,
    signal: AbortSignal
  ) => Promise<EngineToolProjectionV2Result>
}

/** A token names one admitted turn; request input never selects credentials or a destination. */
export class ToolSessionCapacityError extends Error {}

export function createHostToolDispatcher(now: () => number = Date.now) {
  const sessions = new Map<string, Session>()
  let dispatcherCacheBytes = 0
  return {
    async register(input: {
      tools: HostToolSet
      signal: AbortSignal
      python?: ToolAuthorization | null
      executePython?: (
        body: { serverId: string; toolName: string; input: unknown },
        token: string,
        signal: AbortSignal
      ) => Promise<unknown>
    }): Promise<HostToolSession> {
      for (const session of sessions.values())
        if (session.expiresAt <= now()) await session.close()
      input.signal.throwIfAborted()
      if (sessions.size >= 128)
        throw new ToolSessionCapacityError('Tool session capacity reached')
      const entries = await Promise.all(
        Object.entries(input.tools.tools).map(async ([name, definition]) => {
          const schema = asSchema(definition.inputSchema)
          const descriptor = approvedToolSchema.parse({
            name,
            serverId: 'klicker-host',
            description: definition.description,
            inputSchema: await schema.jsonSchema,
          })
          return { descriptor, definition, schema }
        })
      )
      const token = randomBytes(32).toString('base64url')
      if (sessions.has(token))
        throw new Error('Tool capability is already active')
      const descriptors = [
        ...entries.map((entry) => entry.descriptor),
        ...(input.python?.tools ?? []),
      ]
      if (
        new Set(descriptors.map((descriptor) => descriptor.name)).size !==
        descriptors.length
      )
        throw new Error('Tool identity is ambiguous')
      const fallbackValidators = new Map(
        descriptors
          .filter(
            (descriptor) =>
              !entries.find((entry) => entry.descriptor === descriptor)?.schema
                .validate
          )
          .map((descriptor) => {
            const dialect = descriptor.inputSchema.$schema
            const Validator =
              typeof dialect === 'string' && dialect.includes('2020-12')
                ? Ajv2020
                : typeof dialect === 'string' && dialect.includes('2019-09')
                  ? Ajv2019
                  : Ajv
            const validator = new Validator({
              strict: false,
              coerceTypes: false,
              useDefaults: false,
              removeAdditional: false,
              logger: false,
            })
            addFormats(validator)
            const validate = validator.compile(descriptor.inputSchema)
            if ('$async' in validate && validate.$async)
              throw new Error('Asynchronous tool schemas are unavailable')
            return [descriptor.name, validate] as const
          })
      )
      input.signal.throwIfAborted()
      if (sessions.size >= 128)
        throw new ToolSessionCapacityError('Tool session capacity reached')
      const maxProjectionRequests =
        chatToolStepBudget(
          Object.hasOwn(input.tools.tools, SHOW_EXPLANATION_TOOL_NAME) ||
            Object.hasOwn(input.tools.tools, SHOW_FEEDBACK_TOOL_NAME)
        ) - 1
      const controller = new AbortController()
      const signal = AbortSignal.any([input.signal, controller.signal])
      const calls = new Map<
        string,
        {
          request: EngineToolExecutionV2Request
          completion: Promise<void>
          encoded?: string
        }
      >()
      let cacheBytes = 0
      let projectionRequests = 0
      let projectionQueue = Promise.resolve()
      let acceptedIds: string[] = []
      const registeredAt = now()
      const expiresAt = registeredAt + 300_000
      const pythonExpiresAt = registeredAt + 120_000
      let closed = false
      let closePromise: Promise<void> | undefined
      let expiryTimer: ReturnType<typeof setTimeout> | undefined
      const close = () => {
        closePromise ??= Promise.resolve().then(() => input.tools.close())
        if (!closed) {
          closed = true
          sessions.delete(token)
          if (expiryTimer) clearTimeout(expiryTimer)
          input.signal.removeEventListener('abort', closeOnAbort)
          controller.abort()
          dispatcherCacheBytes -= cacheBytes
          cacheBytes = 0
          calls.clear()
        }
        return closePromise
      }
      const closeOnAbort = () => {
        void close().catch(() => undefined)
      }
      input.signal.addEventListener('abort', closeOnAbort, { once: true })
      expiryTimer = setTimeout(closeOnAbort, expiresAt - registeredAt)
      expiryTimer.unref()
      sessions.set(token, {
        close,
        expiresAt,
        async execute(raw, callerSignal) {
          const callSignal = AbortSignal.any([signal, callerSignal])
          callSignal.throwIfAborted()
          const body = engineToolExecutionV2RequestSchema.parse(raw)
          const previous = calls.get(body.toolCallId)
          if (previous) {
            if (!isDeepStrictEqual(previous.request, body))
              throw new Error('Tool call identity was reused')
            await previous.completion
            callSignal.throwIfAborted()
            if (expiresAt <= now()) throw new Error('Tool capability expired')
            return JSON.parse(previous.encoded!) as EngineToolExecutionV2Result
          }
          const descriptor = descriptors.find(
            (candidate) =>
              candidate.name === body.toolName &&
              candidate.serverId === body.serverId
          )
          if (!descriptor || calls.size >= 64)
            throw new Error('Tool is not admitted')
          const entry = entries.find(
            (candidate) => candidate.descriptor === descriptor
          )
          let resolve!: () => void
          let reject!: (error: Error) => void
          const completion = new Promise<void>((done, failed) => {
            resolve = done
            reject = failed
          })
          const call: {
            request: EngineToolExecutionV2Request
            completion: Promise<void>
            encoded?: string
          } = { request: body, completion }
          calls.set(body.toolCallId, call)
          void completion.catch(() => undefined)
          void (async () => {
            let output: unknown
            let modelOutput: unknown
            let validatedInput: unknown = structuredClone(body.input)
            const validated = entry?.schema.validate
              ? await entry.schema.validate(validatedInput)
              : fallbackValidators.get(body.toolName)?.(validatedInput) === true
                ? { success: true as const, value: validatedInput }
                : { success: false as const }
            callSignal.throwIfAborted()
            if (!validated.success) throw new Error('Invalid tool input')
            validatedInput = validated.value
            if (!entry) {
              if (!input.python || !input.executePython)
                throw new Error('Python execution is unavailable')
              const remaining = pythonExpiresAt - now()
              if (remaining <= 0) throw new Error('Python capability expired')
              const pythonSignal = AbortSignal.any([
                callSignal,
                AbortSignal.timeout(remaining),
              ])
              output = await input.executePython(
                {
                  serverId: body.serverId,
                  toolName: body.toolName,
                  input: validatedInput,
                },
                input.python.executionToken,
                pythonSignal
              )
              pythonSignal.throwIfAborted()
            } else {
              if (!entry.definition.execute)
                throw new Error('Tool execution is unavailable')
              output = await toolResultValue(
                await entry.definition.execute(validatedInput, {
                  toolCallId: body.toolCallId,
                  messages: [] as ModelMessage[],
                  abortSignal: callSignal,
                  context: {},
                }),
                callSignal
              )
            }
            callSignal.throwIfAborted()
            const rawOutput = JSON.stringify(output)
            if (
              rawOutput === undefined ||
              Buffer.byteLength(rawOutput) >
                CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES
            )
              throw new Error('Tool result exceeds the byte limit')
            if (entry?.definition.toModelOutput) {
              modelOutput = await entry.definition.toModelOutput({
                toolCallId: body.toolCallId,
                input: validatedInput,
                output: JSON.parse(rawOutput),
              })
            } else {
              modelOutput = { type: 'json', value: JSON.parse(rawOutput) }
            }
            if (modelOutput === undefined)
              throw new Error('Tool model output is unavailable')
            const result = engineToolExecutionV2ResultSchema.parse({
              output: JSON.parse(rawOutput),
              modelOutput,
            })
            const encoded = JSON.stringify(result)
            const bytes = Buffer.byteLength(encoded)
            callSignal.throwIfAborted()
            if (expiresAt <= now()) throw new Error('Tool capability expired')
            if (
              bytes > CHAT_ENGINE_MAX_V2_TOOL_RESULT_BYTES ||
              cacheBytes + bytes > CHAT_ENGINE_MAX_V2_TOOL_CACHE_BYTES ||
              dispatcherCacheBytes + bytes >
                CHAT_ENGINE_MAX_V2_DISPATCHER_CACHE_BYTES
            )
              throw new Error('Tool result cache exceeds the byte limit')
            cacheBytes += bytes
            dispatcherCacheBytes += bytes
            call.encoded = encoded
          })().then(resolve, () => {
            const error = new Error(
              callSignal.aborted
                ? 'Tool execution aborted'
                : 'Tool execution failed'
            )
            if (callSignal.aborted) error.name = 'AbortError'
            reject(error)
          })
          await completion
          callSignal.throwIfAborted()
          if (expiresAt <= now()) throw new Error('Tool capability expired')
          return JSON.parse(call.encoded!) as EngineToolExecutionV2Result
        },
        async project(raw, callerSignal) {
          const callSignal = AbortSignal.any([signal, callerSignal])
          callSignal.throwIfAborted()
          if (++projectionRequests > maxProjectionRequests)
            throw new Error('Tool projection request limit reached')
          const body = engineToolProjectionV2RequestSchema.parse(raw)
          const previousProjection = projectionQueue
          let releaseProjection!: () => void
          projectionQueue = new Promise<void>((resolve) => {
            releaseProjection = resolve
          })
          await previousProjection
          try {
            callSignal.throwIfAborted()
            if (
              body.toolCallIds.length < acceptedIds.length ||
              acceptedIds.some((id, index) => body.toolCallIds[index] !== id)
            )
              throw new Error('Tool projection order changed')
            const ordered = body.toolCallIds.map((toolCallId) => {
              const call = calls.get(toolCallId)
              if (!call?.encoded) throw new Error('Tool result is unavailable')
              return {
                toolCallId,
                request: call.request,
                result: JSON.parse(call.encoded) as EngineToolExecutionV2Result,
              }
            })
            const completedSteps = [
              {
                content: ordered.flatMap(({ toolCallId, request, result }) => [
                  {
                    type: 'tool-call',
                    toolCallId,
                    toolName: request.toolName,
                    input: request.input,
                  },
                  {
                    type: 'tool-result',
                    toolCallId,
                    toolName: request.toolName,
                    output: result.output,
                  },
                ]),
              },
            ]
            let projected = withModelCitationIndices(
              [
                {
                  role: 'tool',
                  content: ordered.map(({ toolCallId, request, result }) => ({
                    type: 'tool-result',
                    toolCallId,
                    toolName: request.toolName,
                    output: result.modelOutput!,
                  })),
                },
              ] as ModelMessage[],
              completedSteps
            )
            if (input.tools.courseImageVision) {
              const prepared =
                await input.tools.courseImageVision.prepareMessages(
                  projected,
                  completedSteps
                )
              projected = prepared.messages
            }
            const message = projected[0]
            if (message?.role !== 'tool')
              throw new Error('Tool projection is unavailable')
            const result = engineToolProjectionV2ResultSchema.parse({
              contractVersion: CHAT_ENGINE_CONTRACT_V2,
              outputs: message.content.map((part) => {
                if (part.type !== 'tool-result')
                  throw new Error('Tool projection is unavailable')
                return { toolCallId: part.toolCallId, modelOutput: part.output }
              }),
            })
            if (
              Buffer.byteLength(JSON.stringify(result)) >
              CHAT_ENGINE_MAX_V2_TOOL_PROJECTION_BYTES
            )
              throw new Error('Tool projection exceeds the byte limit')
            callSignal.throwIfAborted()
            if (expiresAt <= now()) throw new Error('Tool capability expired')
            acceptedIds = [...body.toolCallIds]
            return result
          } finally {
            releaseProjection()
          }
        },
      })
      return { tools: descriptors, executionToken: token, close }
    },
    isAuthorized(token: string | undefined) {
      const session = token ? sessions.get(token) : undefined
      return Boolean(session && session.expiresAt > now())
    },
    async execute(
      token: string | undefined,
      body: unknown,
      signal: AbortSignal
    ) {
      const session = token ? sessions.get(token) : undefined
      if (!session) return null
      if (session.expiresAt <= now()) {
        void session.close().catch(() => undefined)
        return null
      }
      return session.execute(body, signal)
    },
    async project(
      token: string | undefined,
      body: unknown,
      signal: AbortSignal
    ): Promise<EngineToolProjectionV2Result | null> {
      const session = token ? sessions.get(token) : undefined
      if (!session) return null
      if (session.expiresAt <= now()) {
        void session.close().catch(() => undefined)
        return null
      }
      return session.project(body, signal)
    },
  }
}

export async function projectHistoricalToolResults(
  messages: EngineV2Message[],
  tools: ToolSet
): Promise<EngineV2Message[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) => {
          if (
            message.role !== 'assistant' ||
            part.type !== 'tool-call' ||
            part.output === undefined ||
            part.isError
          )
            return part
          const definition = tools[part.toolName]
          if (!definition?.toModelOutput) return part
          const modelOutput = await definition.toModelOutput({
            toolCallId: part.toolCallId,
            input: part.input,
            output: part.output,
          })
          return {
            ...part,
            modelOutput: engineToolExecutionV2ResultSchema.parse({
              output: part.output,
              modelOutput,
            }).modelOutput,
          }
        })
      ),
    }))
  )
}
