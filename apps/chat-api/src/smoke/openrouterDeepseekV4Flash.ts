import { prisma } from '@klicker-uzh/prisma'
import { SignJWT } from 'jose'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const DEFAULT_API_BASE_URL = 'http://localhost:3005'
const DEFAULT_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const DEFAULT_MODEL_ID = 'deepseek-v4-flash'
const DEFAULT_MODEL_DEPLOYMENT_ID = 'deepseek/deepseek-v4-flash'
const DEFAULT_USERNAME = 'testuser1'

type UiPart = {
  type: string
  delta?: string
  text?: string
  errorText?: string
  messageMetadata?: {
    finishReason?: string
    chatMode?: string
    modelId?: string
    reasoningEffort?: string | null
    creditsUsed?: number | null
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

async function createParticipantToken(participantId: string): Promise<string> {
  return new SignJWT({ sub: participantId, role: 'PARTICIPANT' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(Buffer.from(requireEnv('APP_SECRET'), 'utf8'))
}

function assertOpenRouterRuntime(modelId: string, deploymentId: string) {
  const baseUrl = requireEnv('OPENAI_BASE_URL')
  requireEnv('OPENAI_API_KEY')

  if (!baseUrl.includes('openrouter.ai')) {
    throw new Error(
      `OPENAI_BASE_URL must point at OpenRouter for this smoke test; got ${baseUrl}`
    )
  }

  const rawRegistry = requireEnv('CHAT_MODEL_REGISTRY_JSON')
  const registry = JSON.parse(rawRegistry) as Array<{
    id?: string
    deploymentId?: string
  }>
  const model = registry.find((entry) => entry.id === modelId)
  if (!model) {
    throw new Error(`CHAT_MODEL_REGISTRY_JSON must include ${modelId}`)
  }
  if (model.deploymentId !== deploymentId) {
    throw new Error(
      `CHAT_MODEL_REGISTRY_JSON entry ${modelId} must deploy ${deploymentId}; got ${model.deploymentId}`
    )
  }

  const fallbackModelId = requireEnv('FALLBACK_MODEL_ID')
  if (fallbackModelId !== deploymentId) {
    throw new Error(
      `FALLBACK_MODEL_ID must be ${deploymentId} so OpenRouter retries do not fall back to an Azure-only id`
    )
  }

  if (
    (process.env.CHAT_OPENAI_STORE_RESPONSES ?? '').toLowerCase() !== 'false'
  ) {
    throw new Error(
      'CHAT_OPENAI_STORE_RESPONSES=false is required for the OpenRouter smoke backend'
    )
  }
}

async function prepareSeededParticipant(
  chatbotId: string,
  username: string,
  modelId: string
): Promise<{ participantId: string; creditsBefore: number }> {
  const participant = await prisma.participant.findUnique({
    where: { username },
    select: { id: true },
  })
  assert(participant, `Seeded participant not found: ${username}`)

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      id: true,
      modelSelection: true,
      allowedModelIds: true,
      disclaimerId: true,
    },
  })
  assert(chatbot, `Seeded chatbot not found: ${chatbotId}`)
  assert.equal(
    chatbot.modelSelection,
    true,
    'Smoke test requires chatbot.modelSelection=true so selectedModel is honored'
  )
  assert(
    chatbot.allowedModelIds.length === 0 ||
      chatbot.allowedModelIds.includes(modelId),
    `Smoke model ${modelId} is blocked by chatbot.allowedModelIds`
  )

  const current = 100
  await prisma.chatUsageCredits.upsert({
    where: {
      participantId_chatbotId: {
        participantId: participant.id,
        chatbotId,
      },
    },
    create: {
      participantId: participant.id,
      chatbotId,
      current,
      total: current,
      acceptedDisclaimerId: chatbot.disclaimerId,
      disclaimerAcceptedAt: chatbot.disclaimerId ? new Date() : null,
      disclaimerDeclined: false,
    },
    update: {
      current,
      total: current,
      acceptedDisclaimerId: chatbot.disclaimerId,
      disclaimerAcceptedAt: chatbot.disclaimerId ? new Date() : null,
      disclaimerDeclined: false,
    },
  })

  return { participantId: participant.id, creditsBefore: current }
}

async function readUiStream(response: Response): Promise<{
  text: string
  textDeltaParts: number
  finish: UiPart | null
}> {
  const reader = response.body?.getReader()
  assert(reader, 'Response body is missing')

  const decoder = new TextDecoder()
  let text = ''
  let textDeltaParts = 0
  let finish: UiPart | null = null
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim() || line === 'data: [DONE]') continue
      const raw = line.startsWith('data: ') ? line.slice(6) : line
      const part = JSON.parse(raw) as UiPart

      if (part.type === 'text-delta') {
        text += part.delta ?? part.text ?? ''
        textDeltaParts++
      } else if (part.type === 'finish') {
        finish = part
      } else if (part.type === 'error') {
        throw new Error(part.errorText ?? 'Stream returned an error part')
      }
    }
  }

  return { text, textDeltaParts, finish }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const apiBaseUrl = process.env.CHAT_SMOKE_API_BASE_URL ?? DEFAULT_API_BASE_URL
  const chatbotId = process.env.CHAT_SMOKE_CHATBOT_ID ?? DEFAULT_CHATBOT_ID
  const username = process.env.CHAT_SMOKE_USERNAME ?? DEFAULT_USERNAME
  const modelId = process.env.CHAT_SMOKE_MODEL_ID ?? DEFAULT_MODEL_ID
  const modelDeploymentId =
    process.env.CHAT_SMOKE_MODEL_DEPLOYMENT_ID ?? DEFAULT_MODEL_DEPLOYMENT_ID
  const timeoutMs = Number(process.env.CHAT_SMOKE_TIMEOUT_MS ?? 120_000)

  assertOpenRouterRuntime(modelId, modelDeploymentId)

  const { participantId, creditsBefore } = await prepareSeededParticipant(
    chatbotId,
    username,
    modelId
  )
  const participantToken = await createParticipantToken(participantId)

  const userMessageId = randomUUID()
  const assistantMessageId = randomUUID()
  const nonce = randomUUID().slice(0, 8)
  const url = `${apiBaseUrl.replace(/\/$/, '')}/api/chatbots/${chatbotId}/chat`

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `participant_token=${participantToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            id: userMessageId,
            role: 'user',
            content: `Smoke test ${nonce}: reply in one short sentence and include the token ${nonce}.`,
          },
        ],
        threadId: null,
        selectedModel: modelId,
        selectedMode: 'tutor',
        reasoningEffort: 'none',
        assistantMessageId,
        images: [],
      }),
    },
    timeoutMs
  )

  if (!response.ok) {
    throw new Error(
      `chat-api returned HTTP ${response.status}: ${await response.text()}`
    )
  }

  const stream = await readUiStream(response)
  assert(stream.textDeltaParts > 0, 'Expected at least one text-delta part')
  assert(stream.finish, 'Expected finish part')
  assert.equal(stream.finish.messageMetadata?.modelId, modelId)
  assert.equal(stream.finish.messageMetadata?.chatMode, 'tutor')
  assert.equal(stream.finish.messageMetadata?.reasoningEffort, null)
  assert.equal(typeof stream.finish.messageMetadata?.creditsUsed, 'number')
  assert(
    (stream.finish.messageMetadata?.creditsUsed ?? 0) > 0,
    'Expected positive creditsUsed metadata'
  )
  assert(stream.text.trim().length > 0, 'Expected non-empty assistant text')

  const persisted = await prisma.chatMessage.findMany({
    where: { id: { in: [userMessageId, assistantMessageId] } },
    select: {
      id: true,
      role: true,
      content: true,
      modelId: true,
      chatMode: true,
      creditsUsed: true,
      threadId: true,
    },
  })
  const userMessage = persisted.find((message) => message.id === userMessageId)
  const assistantMessage = persisted.find(
    (message) => message.id === assistantMessageId
  )

  assert(userMessage, 'Expected persisted user message')
  assert(assistantMessage, 'Expected persisted assistant message')
  assert.equal(userMessage.threadId, assistantMessage.threadId)
  assert.equal(assistantMessage.modelId, modelId)
  assert.equal(assistantMessage.chatMode, 'tutor')
  const persistedCreditsUsed = assistantMessage.creditsUsed?.toNumber() ?? 0
  assert(persistedCreditsUsed > 0, 'Expected persisted assistant creditsUsed')

  const creditsAfter = await prisma.chatUsageCredits.findUniqueOrThrow({
    where: {
      participantId_chatbotId: {
        participantId,
        chatbotId,
      },
    },
    select: { current: true },
  })
  assert(
    creditsAfter.current.toNumber() < creditsBefore,
    'Expected credits to decrement after live stream'
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        modelId,
        modelDeploymentId,
        chatbotId,
        username,
        textDeltaParts: stream.textDeltaParts,
        creditsUsed: stream.finish.messageMetadata?.creditsUsed,
        threadId: assistantMessage.threadId,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
