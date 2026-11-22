import { signJWT, verifyJWT } from '@klicker-uzh/util'
import { z } from 'zod'
import {
  CHAT_TAB_HANDOFF_SCOPE,
  PWA_CHAT_EMBED_EXCHANGE_SCOPE,
  PWA_CHAT_EMBED_SESSION_SCOPE,
} from '@/src/lib/pwaEmbedAuth'

const PWA_CHAT_EMBED_SESSION_EXPIRY = '12h'
// Long enough for the new tab to load, short enough that a leaked URL from
// history or logs is useless soon after.
const CHAT_TAB_HANDOFF_EXPIRY = '60s'

const pwaEmbedPayloadSchema = z.object({
  sub: z.string().min(1),
  scope: z.literal(PWA_CHAT_EMBED_EXCHANGE_SCOPE),
  chatbotId: z.string().guid(),
  cookiesAvailable: z.boolean(),
  courseId: z.string().guid(),
})

const pwaEmbedSessionPayloadSchema = z.object({
  sub: z.string().min(1),
  scope: z.literal(PWA_CHAT_EMBED_SESSION_SCOPE),
  chatbotId: z.string().guid(),
  courseId: z.string().guid(),
  // Opaque eLearning learner pseudonym; set only for eLearning handoffs.
  learnerBinding: z.string().min(1).max(128).optional(),
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
  learnerBinding,
}: {
  chatbotId: string
  courseId: string
  participantId: string
  learnerBinding?: string
}): Promise<string> {
  return signJWT(
    {
      sub: participantId,
      scope: PWA_CHAT_EMBED_SESSION_SCOPE,
      chatbotId,
      courseId,
      ...(learnerBinding ? { learnerBinding } : {}),
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

const chatTabHandoffPayloadSchema = z.object({
  sub: z.string().min(1),
  scope: z.literal(CHAT_TAB_HANDOFF_SCOPE),
  // `guest` re-issues the anonymous LTI guest session; `account` issues a
  // session scoped to this chatbot, never the participant's full account token.
  kind: z.enum(['guest', 'account']),
  chatbotId: z.string().guid(),
  courseId: z.string().guid(),
  learnerBinding: z.string().min(1).max(128).optional(),
})

export type ChatTabHandoffPayload = z.infer<typeof chatTabHandoffPayloadSchema>

export async function signChatTabHandoffToken({
  participantId,
  kind,
  chatbotId,
  courseId,
  learnerBinding,
}: {
  participantId: string
  kind: ChatTabHandoffPayload['kind']
  chatbotId: string
  courseId: string
  learnerBinding?: string
}): Promise<string> {
  return signJWT(
    {
      sub: participantId,
      scope: CHAT_TAB_HANDOFF_SCOPE,
      kind,
      chatbotId,
      courseId,
      ...(learnerBinding ? { learnerBinding } : {}),
    },
    getPwaEmbedSecret(),
    { algorithm: 'HS256', expiresIn: CHAT_TAB_HANDOFF_EXPIRY }
  )
}

export async function verifyChatTabHandoffToken(
  token: string
): Promise<ChatTabHandoffPayload> {
  const payload = await verifyJWT(token, getPwaEmbedSecret())
  return chatTabHandoffPayloadSchema.parse(payload)
}
