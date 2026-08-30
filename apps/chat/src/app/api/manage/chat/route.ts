import { createOpenAI } from '@ai-sdk/openai'
import { convertToModelMessages, isStepCount, streamText } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { getChatModelRegistry } from '@/src/lib/server/chatModelRegistry'
import { isManageAiEnabled } from '@/src/lib/server/featureFlags'
import { getAuthenticatedManageUser } from '@/src/lib/server/manageAuth'
import {
  MANAGE_CHAT_BODY_TIMEOUT_MS,
  MANAGE_CHAT_TOTAL_TIMEOUT_MS,
  readBoundedJson,
  releaseWhenResponseCompletes,
  tryAcquireManageChatRequest,
  validateManageChatRequest,
} from '@/src/lib/server/manageChatRequest'
import { loadLecturerMcpTools } from '@/src/services/lecturerMcp'
import { MANAGE_ASSISTANT_CAPABILITY_HEADER } from '@/src/services/manageAssistantCapabilities'
import {
  buildManageAssistantSystemPrompt,
  getManageAssistantOpenAIProviderOptions,
  selectManageAssistantModel,
} from '@/src/services/manageAssistantRuntime'
import { sanitizeManageAssistantContext } from '@/src/services/manageContext'
import { resolveLatestManageProposalContext } from '@/src/services/manageProposalContext'
import { createRateLimiter } from '@/src/services/rateLimiter'
import { createFenceSentinel } from '@/src/services/toolOutputFencing'

export const runtime = 'nodejs'
export const maxDuration = 60

const isAiTelemetryEnabled = process.env.CHAT_ENABLE_AI_TELEMETRY !== 'false'

// Best-effort, per-pod limiter (see rateLimiter.ts) — 30 requests / 5 minutes
// per authenticated lecturer.
const chatRateLimiter = createRateLimiter(30, 5 * 60 * 1000)

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

  if (!(await isManageAiEnabled(manageUser))) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const releaseRequest = tryAcquireManageChatRequest()
  if (!releaseRequest) {
    return NextResponse.json(
      { error: 'Manage assistant is busy' },
      { status: 503, headers: { 'Retry-After': '1' } }
    )
  }

  const requestSignal = AbortSignal.any([
    req.signal,
    AbortSignal.timeout(MANAGE_CHAT_TOTAL_TIMEOUT_MS),
  ])
  let releaseRequestInFinally = true
  try {
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

    const bodySignal = AbortSignal.any([
      requestSignal,
      AbortSignal.timeout(MANAGE_CHAT_BODY_TIMEOUT_MS),
    ])
    const body = await readBoundedJson(req, undefined, bodySignal)
    if (!body.ok) {
      return NextResponse.json(
        {
          error:
            body.error === 'TOO_LARGE'
              ? 'Request body too large'
              : body.error === 'TIMEOUT'
                ? 'Request timed out'
                : 'Invalid request body',
        },
        {
          status:
            body.error === 'TOO_LARGE'
              ? 413
              : body.error === 'TIMEOUT'
                ? 408
                : 400,
        }
      )
    }

    const parsed = await validateManageChatRequest(body.value)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const context = sanitizeManageAssistantContext(parsed.manageContext)
    const proposalSecret =
      process.env.MCP_LECTURER_JWT_SECRET ?? process.env.APP_SECRET
    const proposalIssuer = process.env.APP_ORIGIN_AUTH
    const previousProposal =
      proposalSecret && proposalIssuer
        ? await resolveLatestManageProposalContext(
            parsed.proposalTokens,
            userId,
            { issuer: proposalIssuer, secret: proposalSecret }
          )
        : null
    // The gate above already refused every request that must not reach the
    // tools, so loading them needs no second check. A load failure still
    // leaves a toolless but usable assistant rather than ending the turn.
    const noLecturerMcpTools = {
      capabilityState: 'unavailable' as const,
      close: async () => {},
      sentinel: createFenceSentinel(),
      tools: {},
    }
    const lecturerMcp = await loadLecturerMcpTools(
      userId,
      manageUser.scope,
      undefined,
      requestSignal
    ).catch((error) => {
      console.warn('Failed to load lecturer MCP tools:', error)
      return noLecturerMcpTools
    })
    const selectedModel = selectManageAssistantModel(getChatModelRegistry())
    const modelMessages = await convertToModelMessages(parsed.messages, {
      ignoreIncompleteToolCalls: true,
    })

    const closeTools = async () => {
      await lecturerMcp.close()
    }

    try {
      const result = streamText({
        abortSignal: requestSignal,
        experimental_telemetry: { isEnabled: isAiTelemetryEnabled },
        maxOutputTokens: selectedModel.maxOutputTokens,
        messages: modelMessages,
        model: createManageAssistantModel(selectedModel.deploymentId),
        providerOptions: {
          openai: getManageAssistantOpenAIProviderOptions(),
        },
        stopWhen: isStepCount(5),
        system: buildManageAssistantSystemPrompt(
          context,
          lecturerMcp.capabilityState !== 'unavailable',
          lecturerMcp.capabilityState === 'draft-and-read',
          lecturerMcp.sentinel,
          previousProposal
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

      const response = result.toUIMessageStreamResponse({
        headers: {
          [MANAGE_ASSISTANT_CAPABILITY_HEADER]: lecturerMcp.capabilityState,
        },
        sendReasoning: true,
      })
      releaseRequestInFinally = false
      return releaseWhenResponseCompletes(
        response,
        releaseRequest,
        requestSignal
      )
    } catch (error) {
      await closeTools()
      console.error('Manage assistant request failed:', error)
      return NextResponse.json(
        { error: 'Manage assistant request failed' },
        { status: 500 }
      )
    }
  } finally {
    if (releaseRequestInFinally) {
      releaseRequest()
    }
  }
}
