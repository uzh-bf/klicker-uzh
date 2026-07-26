import { getChatModelRegistry } from '@/src/lib/server/chatModelRegistry'
import { getAuthenticatedManageUser } from '@/src/lib/server/manageAuth'
import { loadLecturerMcpTools } from '@/src/services/lecturerMcp'
import {
  buildManageAssistantSystemPrompt,
  getManageAssistantOpenAIProviderOptions,
  selectManageAssistantModel,
} from '@/src/services/manageAssistantRuntime'
import { sanitizeManageAssistantContext } from '@/src/services/manageContext'
import { createRateLimiter } from '@/src/services/rateLimiter'
import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

const isAiTelemetryEnabled = process.env.CHAT_ENABLE_AI_TELEMETRY !== 'false'

// Best-effort, per-pod limiter (see rateLimiter.ts) — 30 requests / 5 minutes
// per authenticated lecturer.
const chatRateLimiter = createRateLimiter(30, 5 * 60 * 1000)

const manageChatRequestSchema = z.object({
  manageContext: z.unknown().optional(),
  messages: z
    .array(
      z.custom<UIMessage>(
        (value) =>
          typeof value === 'object' &&
          value !== null &&
          Array.isArray((value as { parts?: unknown }).parts)
      )
    )
    .min(1)
    .max(50),
})

const responsesApiFetch: typeof globalThis.fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body)
      if (Array.isArray(body.input)) {
        body.input = body.input.map((item: Record<string, unknown>) =>
          item.role === 'assistant'
            ? { ...item, type: 'message', status: 'completed' }
            : item
        )
        init = { ...init, body: JSON.stringify(body) }
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error
      }
    }
  }

  return globalThis.fetch(input, init)
}

function createManageAssistantModel(deploymentId: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for the Manage assistant')
  }

  return createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey,
    fetch: responsesApiFetch,
  })(deploymentId)
}

export async function POST(req: NextRequest) {
  const manageUser = await getAuthenticatedManageUser()
  if (!manageUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = manageUser.sub

  const rateLimit = chatRateLimiter.check(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = manageChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const context = sanitizeManageAssistantContext(parsed.data.manageContext)
  const lecturerMcp = await loadLecturerMcpTools(
    userId,
    manageUser.scope
  ).catch((error) => {
    console.warn('Failed to load lecturer MCP tools:', error)
    return {
      close: async () => {},
      hasDraftScope: false,
      tools: {},
    }
  })
  const toolCount = Object.keys(lecturerMcp.tools).length
  const selectedModel = selectManageAssistantModel(getChatModelRegistry())
  const modelMessages = await convertToModelMessages(parsed.data.messages, {
    ignoreIncompleteToolCalls: true,
  })

  const closeTools = async () => {
    await lecturerMcp.close()
  }

  try {
    const result = streamText({
      abortSignal: req.signal,
      experimental_telemetry: { isEnabled: isAiTelemetryEnabled },
      maxOutputTokens: selectedModel.maxOutputTokens,
      messages: modelMessages,
      model: createManageAssistantModel(selectedModel.deploymentId),
      providerOptions: {
        openai: getManageAssistantOpenAIProviderOptions(),
      },
      stopWhen: stepCountIs(5),
      system: buildManageAssistantSystemPrompt(
        context,
        toolCount > 0,
        lecturerMcp.hasDraftScope
      ),
      toolChoice: 'auto',
      tools: lecturerMcp.tools,
      onAbort: closeTools,
      onError: async (error) => {
        console.error('Manage assistant stream failed:', error)
        await closeTools()
      },
      onFinish: closeTools,
    })

    return result.toUIMessageStreamResponse({ sendReasoning: true })
  } catch (error) {
    await closeTools()
    console.error('Manage assistant request failed:', error)
    return NextResponse.json(
      { error: 'Manage assistant request failed' },
      { status: 500 }
    )
  }
}
