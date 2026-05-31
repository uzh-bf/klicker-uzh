import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getChatModelRegistry } from '../../../../lib/server/chatModelRegistry'
import { getAuthenticatedManageUserId } from '../../../../lib/server/manageAuth'
import { getOpenAIResponsesStore } from '../../../../lib/server/openaiResponsesOptions'
import { loadLecturerMcpTools } from '../../../../services/lecturerMcp'
import {
  buildManageAssistantSystemPrompt,
  selectManageAssistantModel,
} from '../../../../services/manageAssistantRuntime'
import { sanitizeManageAssistantContext } from '../../../../services/manageContext'

export const runtime = 'nodejs'
export const maxDuration = 60

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
  return createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY || 'no-key',
    fetch: responsesApiFetch,
  })(deploymentId)
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedManageUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = manageChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const context = sanitizeManageAssistantContext(parsed.data.manageContext)
  const lecturerMcp = await loadLecturerMcpTools(userId).catch((error) => {
    console.warn('Failed to load lecturer MCP tools:', error)
    return {
      close: async () => {},
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
      maxOutputTokens: selectedModel.maxOutputTokens,
      messages: modelMessages,
      model: createManageAssistantModel(selectedModel.deploymentId),
      providerOptions: {
        openai: {
          store: getOpenAIResponsesStore(),
        },
      },
      stopWhen: stepCountIs(5),
      system: buildManageAssistantSystemPrompt(context, toolCount > 0),
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
