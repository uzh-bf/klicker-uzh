import { randomBytes, randomUUID } from 'node:crypto'
import {
  approvedToolSchema,
  type EngineToolExecutionV2Result,
  type EngineV2ChatRequest,
  type EngineV2Message,
  engineToolExecutionV2ResultSchema,
} from '@klicker-uzh/chat-engine-contract'
import { prisma } from '@klicker-uzh/prisma'
import { asSchema, type ModelMessage, type ToolSet, tool } from 'ai'
import { z } from 'zod'
import { withCalculatorTool } from '../host/lib/server/calculatorTool.js'
import type { AuthMode } from '../host/lib/server/chatGuestToken.js'
import { withModelCitationIndices } from '../host/lib/server/citationInstructions.js'
import { resolveEffectiveMCPConfigurations } from '../host/lib/server/effectiveChatModes.js'
import { RequiredMCPUnavailableError } from '../host/lib/server/mcpRuntimePolicy.js'
import {
  createResponseExampleSearchTool,
  loadResponseExampleRuntimeSkill,
  RESPONSE_EXAMPLE_SEARCH_TOOL_NAME,
} from '../host/lib/server/responseExampleRuntime.js'
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
}

export type HostToolSet = {
  tools: ToolSet
  promptContext: string
  close: () => Promise<void>
  promptToolNames: string[]
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
    const tools: ToolSet = { ...handle.tools }
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
    return {
      tools: withCalculatorTool(input.mode, tools),
      promptToolNames: Object.keys(tools),
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

type Session = {
  expiresAt: number
  close: () => Promise<void>
  execute: (
    body: unknown,
    signal: AbortSignal
  ) => Promise<EngineToolExecutionV2Result>
}

/** A token names one admitted turn; request input never selects credentials or a destination. */
export function createHostToolDispatcher(now: () => number = Date.now) {
  const sessions = new Map<string, Session>()
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
      if (sessions.size >= 128) throw new Error('Tool session capacity reached')
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
      const token =
        input.python?.executionToken ?? randomBytes(32).toString('base64url')
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
      input.signal.throwIfAborted()
      const controller = new AbortController()
      const signal = AbortSignal.any([input.signal, controller.signal])
      const events: unknown[] = []
      let calls = 0
      let closePromise: Promise<void> | undefined
      let expiryTimer: ReturnType<typeof setTimeout> | undefined
      const close = () => {
        closePromise ??= Promise.resolve().then(async () => {
          sessions.delete(token)
          if (expiryTimer) clearTimeout(expiryTimer)
          input.signal.removeEventListener('abort', closeOnAbort)
          controller.abort()
          await input.tools.close()
        })
        return closePromise
      }
      const closeOnAbort = () => {
        void close().catch(() => undefined)
      }
      input.signal.addEventListener('abort', closeOnAbort, { once: true })
      expiryTimer = setTimeout(closeOnAbort, input.python ? 120_000 : 300_000)
      expiryTimer.unref()
      sessions.set(token, {
        close,
        expiresAt: now() + (input.python ? 120_000 : 300_000),
        async execute(raw, callerSignal) {
          signal.throwIfAborted()
          const body = z
            .object({
              contractVersion: z.literal('v2').optional(),
              serverId: z.string(),
              toolName: z.string(),
              input: z.unknown(),
            })
            .strict()
            .parse(raw)
          const descriptor = descriptors.find(
            (candidate) =>
              candidate.name === body.toolName &&
              candidate.serverId === body.serverId
          )
          if (!descriptor || calls >= 64)
            throw new Error('Tool is not admitted')
          const entry = entries.find(
            (candidate) => candidate.descriptor === descriptor
          )
          const callSignal = AbortSignal.any([signal, callerSignal])
          if (!entry) {
            if (!input.python || !input.executePython)
              throw new Error('Python execution is unavailable')
            calls++
            const output = await input.executePython(
              body,
              input.python.executionToken,
              callSignal
            )
            return engineToolExecutionV2ResultSchema.parse({ output })
          }
          const validated = entry.schema.validate
            ? await entry.schema.validate(body.input)
            : { success: true as const, value: body.input }
          if (!validated.success || !entry.definition.execute)
            throw new Error('Invalid tool input')
          calls++
          const toolCallId = randomUUID()
          const call = {
            type: 'tool-call',
            toolCallId,
            toolName: body.toolName,
            input: validated.value,
          }
          events.push(call)
          const options = {
            toolCallId,
            messages: [] as ModelMessage[],
            abortSignal: callSignal,
            context: {},
          }
          const output = await entry.definition.execute(
            validated.value,
            options
          )
          callSignal.throwIfAborted()
          events.push({
            type: 'tool-result',
            toolCallId,
            toolName: body.toolName,
            output,
          })
          let modelOutput = entry.definition.toModelOutput
            ? await entry.definition.toModelOutput({
                toolCallId,
                input: validated.value,
                output,
              })
            : { type: 'json' as const, value: output }
          const projected = withModelCitationIndices(
            [
              {
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolCallId,
                    toolName: body.toolName,
                    output: modelOutput,
                  },
                ],
              },
            ],
            [{ content: events }]
          )
          const result = projected[0]
          const projectedPart =
            result?.role === 'tool' ? result.content[0] : undefined
          if (projectedPart?.type === 'tool-result')
            modelOutput = projectedPart.output
          return engineToolExecutionV2ResultSchema.parse({
            output,
            modelOutput,
          })
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
      if (!session || session.expiresAt <= now()) return null
      return session.execute(body, signal)
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
