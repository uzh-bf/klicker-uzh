import { randomUUID } from 'node:crypto'
import { importPKCS8, SignJWT } from 'jose'

const DOC_QUERY_SCOPE_TOKEN_ALGORITHM = 'ES256'
const DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS = 5 * 60

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

export interface SignDocQueryScopeTokenOptions {
  /**
   * Knowledge-base ids bound into the token scope. A single id is minted as
   * the scalar kb_id claim the scope verifier requires.
   */
  kbIds: readonly string[]
  /**
   * Owning chatbot, when the caller represents one. Management-side
   * inventory calls omit it and no chatbot_id claim is minted.
   */
  chatbotId?: string
  /** Logical session the token belongs to; anchors the subject claim. */
  sessionId?: string
  /** Unique token id; generated when omitted. */
  jti?: string
}

export async function signDocQueryScopeToken({
  kbIds,
  chatbotId,
  sessionId,
  jti = randomUUID(),
}: SignDocQueryScopeTokenOptions): Promise<string> {
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
    const kbIdClaim =
      kbIds.length === 1 && typeof kbIds[0] === 'string' ? kbIds[0] : [...kbIds]

    let token = new SignJWT({
      kb_id: kbIdClaim,
      ...(chatbotId ? { chatbot_id: chatbotId } : {}),
    })
      .setProtectedHeader({
        alg: DOC_QUERY_SCOPE_TOKEN_ALGORITHM,
        typ: 'JWT',
        kid,
      })
      .setIssuer(issuer)
      .setAudience(audience)
      .setJti(jti)

    // jose requires a concrete subject string; an absent session simply
    // omits the claim instead of minting an undefined-valued one.
    if (sessionId !== undefined) {
      token = token.setSubject(sessionId)
    }

    return await token
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
