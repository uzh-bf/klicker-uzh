import { signJWT, verifyJWT } from '@klicker-uzh/util'

export const PWA_CHAT_EMBED_EXCHANGE_SCOPE = 'PWA_CHAT_EMBED_EXCHANGE'

type PwaChatEmbedExchangeInput = {
  chatbotId: string
  cookiesAvailable: boolean
  courseId: string
  participantToken: string
}

function getAppSecret(): string {
  const secret = process.env.APP_SECRET
  if (!secret) throw new Error('APP_SECRET is required')
  return secret
}

async function getParticipantId(participantToken: string): Promise<string> {
  const payload = await verifyJWT(participantToken, getAppSecret())
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Invalid participant token: missing subject')
  }
  return payload.sub
}

export async function mintPwaChatEmbedExchangeToken({
  chatbotId,
  cookiesAvailable,
  courseId,
  participantToken,
}: PwaChatEmbedExchangeInput): Promise<string> {
  const participantId = await getParticipantId(participantToken)

  return signJWT(
    {
      sub: participantId,
      scope: PWA_CHAT_EMBED_EXCHANGE_SCOPE,
      chatbotId,
      cookiesAvailable,
      courseId,
    },
    getAppSecret(),
    {
      algorithm: 'HS256',
      expiresIn: '2m',
    }
  )
}
