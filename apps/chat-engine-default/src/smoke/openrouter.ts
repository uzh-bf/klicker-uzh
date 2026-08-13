import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  CHAT_ENGINE_CONTRACT_VERSION,
  conformanceRequest,
  parseEngineStreamPart,
} from '@klicker-uzh/chat-engine-contract'

const DEFAULT_ENGINE_URL = 'http://localhost:3015'
const DEFAULT_MODEL_ID = 'deepseek-v4-flash'
const DEFAULT_MODEL_DEPLOYMENT_ID = 'deepseek/deepseek-v4-flash'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function readParts(response: Response) {
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) =>
      parseEngineStreamPart(JSON.parse(line.slice('data: '.length)))
    )
}

async function main() {
  const engineUrl = process.env.CHAT_ENGINE_SMOKE_URL ?? DEFAULT_ENGINE_URL
  const serviceToken = requiredEnv('CHAT_ENGINE_SERVICE_TOKEN')
  const providerApiKey = requiredEnv('OPENAI_API_KEY')
  const providerBaseUrl = requiredEnv('OPENAI_BASE_URL')
  const modelId = process.env.CHAT_SMOKE_MODEL_ID ?? DEFAULT_MODEL_ID
  const deploymentId =
    process.env.CHAT_SMOKE_MODEL_DEPLOYMENT_ID ?? DEFAULT_MODEL_DEPLOYMENT_ID

  assert(
    providerBaseUrl.includes('openrouter.ai'),
    `OPENAI_BASE_URL must point at OpenRouter; got ${providerBaseUrl}`
  )

  const nonce = randomUUID().slice(0, 8)
  const request = {
    ...conformanceRequest,
    contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
    requestId: randomUUID(),
    runId: randomUUID(),
    userMessageId: randomUUID(),
    assistantMessageId: randomUUID(),
    generation: {
      ...conformanceRequest.generation,
      modelId,
      deploymentId,
      credentialMode: {
        mode: 'request' as const,
        providerBaseUrl,
      },
    },
    messages: [
      {
        ...conformanceRequest.messages[0],
        id: randomUUID(),
        parts: [
          {
            type: 'text' as const,
            text: `Smoke test ${nonce}: reply in one short sentence and include ${nonce}.`,
          },
        ],
      },
    ],
  }

  const response = await fetch(`${engineUrl.replace(/\/$/, '')}/v1/chat`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
      'provider-authorization': `Bearer ${providerApiKey}`,
    },
    body: JSON.stringify(request),
  })
  assert.equal(response.status, 200, await response.text())

  const parts = await readParts(response)
  const text = parts
    .filter(
      (part): part is Extract<typeof part, { type: 'text-delta' }> =>
        part.type === 'text-delta'
    )
    .map((part) => part.delta)
    .join('')
  const finish = parts.find((part) => part.type === 'finish')

  assert(text.trim().length > 0, 'Expected non-empty engine text')
  assert(finish?.type === 'finish', 'Expected an engine finish part')
  assert(
    (finish.messageMetadata.usage.outputTokens ?? 0) > 0,
    'Expected output usage'
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        engineUrl,
        modelId,
        deploymentId,
        text,
        usage: finish.messageMetadata.usage,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
