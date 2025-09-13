import * as jose from 'jose'

export interface JWTPayload extends Record<string, unknown> {
  sub: string
  role?: string
  scope?: string
  email?: string
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
  iat?: number
  exp?: number
}

function getSecretKey(secret: string): Uint8Array {
  // Prefer Node Buffer for wide compatibility; avoids DOM TextEncoder typing
  return Buffer.from(secret, 'utf8')
}

export async function signJWT(
  payload: JWTPayload,
  secret: string,
  options: {
    algorithm?: 'HS256'
    expiresIn?: string | number
    issuer?: string
    issuedAt?: Date
  } = {}
): Promise<string> {
  const alg = options.algorithm ?? 'HS256'
  let jwt = new jose.SignJWT(
    payload as Record<string, unknown>
  ).setProtectedHeader({ alg, typ: 'JWT' })

  if (options.expiresIn) {
    jwt = jwt.setExpirationTime(options.expiresIn)
  }

  if (options.issuer) {
    jwt = jwt.setIssuer(options.issuer)
  }

  if (options.issuedAt) {
    jwt = jwt.setIssuedAt(options.issuedAt)
  }

  return jwt.sign(getSecretKey(secret))
}

export async function verifyJWT(
  token: string,
  secret: string,
  opts: {
    algorithms?: 'HS256'[]
    clockTolerance?: string | number
    issuer?: string
  } = {}
): Promise<JWTPayload> {
  const { payload } = await jose.jwtVerify(token, getSecretKey(secret), {
    algorithms: opts.algorithms ?? ['HS256'],
    clockTolerance: opts.clockTolerance ?? '5s',
    issuer: opts.issuer,
  })
  return payload as JWTPayload
}

export function decodeJWT<T extends Record<string, unknown> = JWTPayload>(
  token: string
): T {
  return jose.decodeJwt(token) as T
}
