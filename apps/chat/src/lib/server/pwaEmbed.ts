import {
  PWA_CHAT_EMBED_EXCHANGE_SCOPE,
  PWA_CHAT_EMBED_SESSION_SCOPE,
} from '@/src/lib/pwaEmbedAuth'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import { z } from 'zod'

const PWA_CHAT_EMBED_SESSION_EXPIRY = '12h'

const pwaEmbedPayloadSchema = z.object({
  sub: z.string().min(1),
  scope: z.literal(PWA_CHAT_EMBED_EXCHANGE_SCOPE),
  chatbotId: z.string().uuid(),
  cookiesAvailable: z.boolean(),
  courseId: z.string().uuid(),
})

const pwaEmbedSessionPayloadSchema = z.object({
  sub: z.string().min(1),
  scope: z.literal(PWA_CHAT_EMBED_SESSION_SCOPE),
  chatbotId: z.string().uuid(),
  courseId: z.string().uuid(),
})

export type PwaEmbedExchangePayload = z.infer<typeof pwaEmbedPayloadSchema>
export type PwaEmbedSessionPayload = z.infer<
  typeof pwaEmbedSessionPayloadSchema
>

function getPwaEmbedSecret(): string {
  const secret = process.env.APP_SECRET
  if (!secret) throw new Error('APP_SECRET is required')
  return secret
}

export async function verifyPwaEmbedExchangeToken(
  token: string
): Promise<PwaEmbedExchangePayload> {
  const payload = await verifyJWT(token, getPwaEmbedSecret())
  return pwaEmbedPayloadSchema.parse(payload)
}

export async function signPwaEmbedSessionToken({
  chatbotId,
  courseId,
  participantId,
}: {
  chatbotId: string
  courseId: string
  participantId: string
}): Promise<string> {
  return signJWT(
    {
      sub: participantId,
      scope: PWA_CHAT_EMBED_SESSION_SCOPE,
      chatbotId,
      courseId,
    },
    getPwaEmbedSecret(),
    {
      algorithm: 'HS256',
      expiresIn: PWA_CHAT_EMBED_SESSION_EXPIRY,
    }
  )
}

export async function verifyPwaEmbedSessionToken(
  token: string
): Promise<PwaEmbedSessionPayload> {
  const payload = await verifyJWT(token, getPwaEmbedSecret())
  return pwaEmbedSessionPayloadSchema.parse(payload)
}
