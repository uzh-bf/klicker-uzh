import { createHash, createPrivateKey, randomUUID, sign } from 'node:crypto'
import type { EngineChatRequest } from '@klicker-uzh/chat-engine-contract'
import { z } from 'zod'

export type ToolAdmission = {
  chatbot: { id: string }
  mode: string
  participantId: string
  runId: string
}
export type ToolAuthorization = {
  tools: EngineChatRequest['tools']
  executionToken: string
}
const scopeValue = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 256)
const hash = (parts: string[]) =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex')

/** The host supplies scope; model input never selects identity or credentials. */
export function createCodeApiAuthorization(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.CHAT_CODEAPI_ENABLED !== 'true') return async () => null
  const config = z
    .object({
      CHAT_CODEAPI_JWT_ISSUER: scopeValue,
      CHAT_CODEAPI_JWT_AUDIENCE: scopeValue,
      CHAT_CODEAPI_JWT_KEY_ID: scopeValue,
      CHAT_CODEAPI_TENANT_ID: scopeValue,
      CHAT_CODEAPI_JWT_PRIVATE_KEY: z.string().min(1),
      CHAT_CODEAPI_PILOT_CHATBOT_IDS: z.string().min(1),
    })
    .safeParse(env)
  if (!config.success) throw new Error('CodeAPI host configuration is invalid')
  const value = config.data
  let privateKey: ReturnType<typeof createPrivateKey>
  let pilots: string[]
  try {
    privateKey = createPrivateKey(
      value.CHAT_CODEAPI_JWT_PRIVATE_KEY.replaceAll('\\n', '\n')
    )
    pilots = z
      .array(scopeValue)
      .min(1)
      .parse(JSON.parse(value.CHAT_CODEAPI_PILOT_CHATBOT_IDS))
    if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error()
  } catch {
    throw new Error('CodeAPI host configuration is invalid')
  }
  const allowed = new Set(pilots)
  return async (input: ToolAdmission): Promise<ToolAuthorization | null> => {
    if (input.mode !== 'tutor' || !allowed.has(input.chatbot.id)) return null
    for (const field of [input.chatbot.id, input.participantId, input.runId])
      scopeValue.parse(field)
    const subject = hash([
      'klicker-codeapi-sub-v1',
      value.CHAT_CODEAPI_TENANT_ID,
      input.participantId,
    ])
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(
      JSON.stringify({
        alg: 'EdDSA',
        typ: 'JWT',
        kid: value.CHAT_CODEAPI_JWT_KEY_ID,
      })
    ).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        iss: value.CHAT_CODEAPI_JWT_ISSUER,
        aud: value.CHAT_CODEAPI_JWT_AUDIENCE,
        sub: subject,
        tenant_id: value.CHAT_CODEAPI_TENANT_ID,
        principal_source: 'external:klicker',
        auth_context_hash: hash([
          'klicker-codeapi-context-v1',
          value.CHAT_CODEAPI_TENANT_ID,
          input.chatbot.id,
          subject,
          'external:klicker',
        ]),
        chatbot_id: input.chatbot.id,
        run_id: input.runId,
        jti: randomUUID(),
        iat: now,
        nbf: now,
        exp: now + 120,
      })
    ).toString('base64url')
    const content = `${header}.${payload}`
    return {
      executionToken: `${content}.${sign(null, Buffer.from(content, 'ascii'), privateKey).toString('base64url')}`,
      tools: [
        {
          serverId: 'catalyst-codeapi',
          name: 'run_python',
          description:
            'Run one bounded Python calculation. No files or package installation.',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', minLength: 1, maxLength: 16 * 1024 },
            },
            required: ['code'],
            additionalProperties: false,
          },
        },
      ],
    }
  }
}
