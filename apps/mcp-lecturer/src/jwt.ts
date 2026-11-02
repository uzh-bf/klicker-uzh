import * as jose from 'jose'

export type LecturerJwtPayload = Record<string, unknown> & {
  sub?: string
}

function secretKey(secret: string): Uint8Array {
  return Buffer.from(secret, 'utf8')
}

export async function signLecturerJwt(
  payload: LecturerJwtPayload,
  secret: string,
  options: {
    expiresIn?: string | number
    issuer?: string
  } = {}
): Promise<string> {
  let jwt = new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()

  if (options.expiresIn != null) {
    jwt = jwt.setExpirationTime(options.expiresIn)
  }

  if (options.issuer) {
    jwt = jwt.setIssuer(options.issuer)
  }

  return jwt.sign(secretKey(secret))
}

export async function verifyLecturerJwt(
  token: string,
  secret: string,
  options: {
    issuer?: string
  } = {}
): Promise<LecturerJwtPayload> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey(secret), {
      algorithms: ['HS256'],
      clockTolerance: '5s',
      issuer: options.issuer,
    })

    return payload as LecturerJwtPayload
  } catch {
    throw new Error('Invalid token')
  }
}
