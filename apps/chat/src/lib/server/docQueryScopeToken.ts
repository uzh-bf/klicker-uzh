import { importPKCS8, SignJWT } from 'jose'

const DOC_QUERY_SCOPE_TOKEN_ALGORITHM = 'ES256'
export const DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS = 5 * 60

export class DocQueryScopeTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocQueryScopeTokenError'
  }
}

function requireScopeTokenEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new DocQueryScopeTokenError(`${name} is not configured`)
  }
  return value
}

export async function signDocQueryScopeToken({
  kbIds,
  chatbotId,
  sessionId,
  jti,
  partnerId,
  chatbotName,
  chatbotUrl,
}: {
  kbIds: readonly string[]
  chatbotId: string
  sessionId: string
  jti: string
  /** Partner service identity; present only on partner-issued tokens. */
  partnerId?: string
  /** Trusted display metadata bound to the signed chatbot scope. */
  chatbotName?: string
  chatbotUrl?: string
}): Promise<string> {
  const privateKeyPem = requireScopeTokenEnv(
    'DOC_QUERY_SCOPE_PRIVATE_KEY'
  ).replaceAll('\\n', '\n')
  const kid = requireScopeTokenEnv('DOC_QUERY_SCOPE_KID')
  const issuer = requireScopeTokenEnv('DOC_QUERY_SCOPE_ISSUER')
  const audience = requireScopeTokenEnv('DOC_QUERY_SCOPE_AUDIENCE')

  try {
    const privateKey = await importPKCS8(
      privateKeyPem,
      DOC_QUERY_SCOPE_TOKEN_ALGORITHM
    )

    return await new SignJWT({
      kb_id: kbIds.length === 1 ? kbIds[0] : kbIds,
      chatbot_id: chatbotId,
      // Partner issuance binds the trusted service identity and display
      // metadata server-side; participant-issued tokens omit these claims.
      ...(partnerId ? { partner: partnerId } : {}),
      ...(chatbotName ? { chatbot_name: chatbotName } : {}),
      ...(chatbotUrl ? { chatbot_url: chatbotUrl } : {}),
    })
      .setProtectedHeader({
        alg: DOC_QUERY_SCOPE_TOKEN_ALGORITHM,
        typ: 'JWT',
        kid,
      })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(sessionId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey)
  } catch (error) {
    if (error instanceof DocQueryScopeTokenError) {
      throw error
    }
    throw new DocQueryScopeTokenError('Scope token signing failed')
  }
}
