import { createHmac, randomUUID } from 'crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'

type ChatCompletionMessage = {
  role?: string
  content?: unknown
}

type ChatCompletionRequest = {
  model?: string
  messages?: ChatCompletionMessage[]
  max_tokens?: number
  temperature?: number
  stop?: string | string[]
}

type UiStreamPart = {
  type: string
  delta?: string
  text?: string
  errorText?: string
  messageMetadata?: {
    creditsUsed?: number | null
    modelId?: string | null
    chatMode?: string | null
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function envValue(name: string, fallback: string): string {
  return process.env[name] && process.env[name]!.length > 0
    ? process.env[name]!
    : fallback
}

function base64url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function signParticipantToken({
  appSecret,
  participantId,
}: {
  appSecret: string
  participantId: string
}) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      sub: participantId,
      role: 'PARTICIPANT',
      iat: now,
      exp: now + 7200,
    })
  )
  const signature = createHmac('sha256', appSecret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${header}.${payload}.${signature}`
}

async function readRequestJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
}

function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const value = part as { type?: string; text?: string }
      return value.type === 'text' && typeof value.text === 'string'
        ? value.text
        : ''
    })
    .filter(Boolean)
    .join('\n')
}

function benchmarkMessagesToTutorInput(messages: ChatCompletionMessage[]) {
  return messages
    .map((message) => {
      const content = messageContentToText(message.content)
      if (!content.trim()) return ''
      return `${message.role ?? 'user'}:\n${content.trim()}`
    })
    .filter(Boolean)
    .join('\n\n')
}

async function readUiStream(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('chat-api response body is missing')

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let finish: UiStreamPart | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim() || line === 'data: [DONE]') continue
      const raw = line.startsWith('data: ') ? line.slice(6) : line
      const part = JSON.parse(raw) as UiStreamPart
      if (part.type === 'text-delta') {
        text += part.delta ?? part.text ?? ''
      } else if (part.type === 'finish') {
        finish = part
      } else if (part.type === 'error') {
        throw new Error(part.errorText ?? 'chat-api stream returned an error')
      }
    }
  }

  return { text, finish }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function openAiError(message: string) {
  return {
    error: {
      message,
      type: 'invalid_request_error',
      code: 'chat_api_proxy_error',
    },
  }
}

async function main() {
  const port = Number(envValue('MATHTUTORBENCH_PROXY_PORT', '43124'))
  const chatApiBaseUrl = envValue(
    'MATHTUTORBENCH_CHAT_API_BASE_URL',
    'http://127.0.0.1:3305'
  ).replace(/\/$/, '')
  const chatbotId = envValue(
    'MATHTUTORBENCH_CHATBOT_ID',
    '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
  )
  const participantId = envValue(
    'MATHTUTORBENCH_PARTICIPANT_ID',
    '6f45065c-667f-4259-818c-c6f6b477eb48'
  )
  const selectedModel = envValue(
    'MATHTUTORBENCH_SELECTED_MODEL',
    'local-e2e-model'
  )
  const selectedMode = envValue('MATHTUTORBENCH_SELECTED_MODE', 'tutor')
  const appSecret = requireEnv('APP_SECRET')
  let requestCount = 0

  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { ok: true, requestCount })
        return
      }

      if (req.method === 'GET' && req.url === '/v1/models') {
        sendJson(res, 200, {
          object: 'list',
          data: [
            {
              id: 'klicker-tutor-chat-api',
              object: 'model',
              created: 0,
              owned_by: 'klicker-uzh',
            },
          ],
        })
        return
      }

      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        sendJson(res, 404, openAiError('not found'))
        return
      }

      requestCount += 1
      const request = (await readRequestJson(req)) as ChatCompletionRequest
      const messages = Array.isArray(request.messages) ? request.messages : []
      const userContent = benchmarkMessagesToTutorInput(messages)
      if (!userContent.trim()) {
        sendJson(res, 400, openAiError('messages must contain text content'))
        return
      }

      const userMessageId = randomUUID()
      const assistantMessageId = randomUUID()
      const chatResponse = await fetch(
        `${chatApiBaseUrl}/api/chatbots/${chatbotId}/chat`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `participant_token=${signParticipantToken({
              appSecret,
              participantId,
            })}`,
          },
          body: JSON.stringify({
            messages: [
              {
                id: userMessageId,
                role: 'user',
                content: userContent,
              },
            ],
            threadId: null,
            selectedModel,
            selectedMode,
            reasoningEffort: 'none',
            assistantMessageId,
            images: [],
          }),
        }
      )

      if (!chatResponse.ok) {
        sendJson(
          res,
          502,
          openAiError(
            `chat-api returned HTTP ${chatResponse.status}: ${await chatResponse.text()}`
          )
        )
        return
      }

      const stream = await readUiStream(chatResponse)
      sendJson(res, 200, {
        id: `chatcmpl-${randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model ?? 'klicker-tutor-chat-api',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: stream.text,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        klicker: {
          chatMode: stream.finish?.messageMetadata?.chatMode ?? null,
          modelId: stream.finish?.messageMetadata?.modelId ?? null,
          creditsUsed: stream.finish?.messageMetadata?.creditsUsed ?? null,
        },
      })
    } catch (error) {
      sendJson(
        res,
        500,
        openAiError(error instanceof Error ? error.message : String(error))
      )
    }
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(
      `[mathtutorbench-proxy] listening on http://127.0.0.1:${port}/v1`
    )
    console.log(`[mathtutorbench-proxy] chat-api ${chatApiBaseUrl}`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
