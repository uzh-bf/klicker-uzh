import { importPKCS8, SignJWT } from 'jose'

const SCOPE_TOKEN_ALGORITHM = 'ES256'
const SCOPE_TOKEN_TTL_SECONDS = 5 * 60

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
  kbId,
  chatbotId,
  sessionId,
  jti,
}: {
  kbId: string
  chatbotId: string
  sessionId: string
  jti: string
}): Promise<string> {
  const privateKeyPem = requireScopeTokenEnv(
    'DOC_QUERY_SCOPE_PRIVATE_KEY'
  ).replaceAll('\\n', '\n')
  const kid = requireScopeTokenEnv('DOC_QUERY_SCOPE_KID')
  const issuer = requireScopeTokenEnv('DOC_QUERY_SCOPE_ISSUER')
  const audience = requireScopeTokenEnv('DOC_QUERY_SCOPE_AUDIENCE')

  try {
    const privateKey = await importPKCS8(privateKeyPem, SCOPE_TOKEN_ALGORITHM)

    return await new SignJWT({
      kb_id: kbId,
      chatbot_id: chatbotId,
    })
      .setProtectedHeader({
        alg: SCOPE_TOKEN_ALGORITHM,
        typ: 'JWT',
        kid,
      })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(sessionId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${SCOPE_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey)
  } catch (error) {
    if (error instanceof DocQueryScopeTokenError) {
      throw error
    }
    throw new DocQueryScopeTokenError('Scope token signing failed')
  }
}
