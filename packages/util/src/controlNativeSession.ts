import { createHmac, timingSafeEqual } from 'node:crypto'
import { decodeProtectedHeader } from 'jose'
import { SESSION_MAX_AGE_SECONDS } from './clientAuth.js'
import { type JWTPayload, signJWT, verifyJWT } from './jwt.js'

export const CONTROL_NATIVE_NAMESPACE = 'control-native:v1'
export const CONTROL_NATIVE_CLIENT = 'klicker-control-v1'
export const CONTROL_NATIVE_CALLBACK = 'ch.uzh.klicker.control:/auth/callback'
export const CONTROL_NATIVE_ORIGINS = [
  'capacitor://localhost',
  'https://localhost',
] as const

export type ControlNativeScope = 'SESSION_EXEC' | 'READ_ONLY'
export type ControlNativeSource =
  | { kind: 'delegated'; id: string; passwordDigest: string }
  | { kind: 'institutional'; id: string }

export const CONTROL_NATIVE_TOKEN_TYPE = 'control-native+jwt'
const AUDIENCE = 'control-graphql'

export interface ControlNativeClaims extends JWTPayload {
  role: 'USER'
  scope: ControlNativeScope
  source: ControlNativeSource
  purpose: 'lecturer-control'
  iat: number
  exp: number
}

export interface ControlNativeDatabase {
  user: {
    findUnique(args: {
      where: { id: string }
      select: {
        id: true
        role: true
        catalystInstitutional: true
        catalystIndividual: true
      }
    }): Promise<{
      id: string
      role: string
      catalystInstitutional: boolean
      catalystIndividual: boolean
    } | null>
  }
  account: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; userId: true; isVerified: true; type: true }
    }): Promise<{
      id: string
      userId: string
      isVerified: boolean
      type: string
    } | null>
  }
  userLogin: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; userId: true; password: true; scope: true }
    }): Promise<{
      id: string
      userId: string
      password: string
      scope: string
    } | null>
  }
}

export function nativePasswordDigest(password: string, secret: string) {
  if (!secret) throw new Error('Missing signing secret')
  return createHmac('sha256', secret)
    .update(`control-native-password:v1\0${password}`)
    .digest('hex')
}

export async function controlNativePrincipal(
  database: ControlNativeDatabase,
  secret: string,
  evidence: JWTPayload | null
) {
  if (
    !evidence?.sub ||
    !['USER', 'ADMIN'].includes(evidence.role ?? '') ||
    !isControlNativeSource(evidence.controlNativeSource)
  )
    return null
  const source = evidence.controlNativeSource
  let scope = controlNativeScope(evidence.scope)
  if (!scope) return null
  const user = await database.user.findUnique({
    where: { id: evidence.sub },
    select: {
      id: true,
      role: true,
      catalystInstitutional: true,
      catalystIndividual: true,
    },
  })
  if (
    !user ||
    user.id !== evidence.sub ||
    !['USER', 'ADMIN'].includes(user.role)
  )
    return null
  if (source.kind === 'delegated') {
    const login = await database.userLogin.findUnique({
      where: { id: source.id },
      select: { id: true, userId: true, password: true, scope: true },
    })
    const currentScope = controlNativeScope(login?.scope)
    if (
      !login ||
      login.id !== source.id ||
      login.userId !== user.id ||
      !currentScope ||
      !secret
    )
      return null
    const digest = nativePasswordDigest(login.password, secret)
    if (
      !timingSafeEqual(Buffer.from(digest), Buffer.from(source.passwordDigest))
    )
      return null
    if (currentScope === 'READ_ONLY') scope = currentScope
  } else {
    const account = await database.account.findUnique({
      where: { id: source.id },
      select: { id: true, userId: true, isVerified: true, type: true },
    })
    if (
      !account ||
      account.id !== source.id ||
      account.userId !== user.id ||
      !account.isVerified ||
      !['oauth', 'oidc'].includes(account.type)
    )
      return null
  }
  return {
    sub: user.id,
    source,
    scope,
    role: 'USER' as const,
    catalystInstitutional: user.catalystInstitutional === true,
    catalystIndividual: user.catalystIndividual === true,
  }
}

// A separate signing context keeps restricted native credentials out of legacy
// consumers that accept the broad browser session key without audience checks.
function nativeSigningKey(secret: string) {
  if (!secret) throw new Error('Missing signing secret')
  return createHmac('sha256', secret)
    .update('control-native-session:v2')
    .digest('hex')
}

export function isControlNativeToken(token: string) {
  try {
    return decodeProtectedHeader(token).typ === CONTROL_NATIVE_TOKEN_TYPE
  } catch {
    return false
  }
}

export async function signControlNativeToken(
  principal: {
    sub: string
    scope: ControlNativeScope
    source: ControlNativeSource
  },
  secret: string,
  issuer: string,
  now = Date.now()
) {
  const iat = Math.floor(now / 1000)
  const exp = iat + SESSION_MAX_AGE_SECONDS
  const token = await signJWT(
    { ...principal, role: 'USER', purpose: 'lecturer-control', exp },
    nativeSigningKey(secret),
    {
      issuer,
      audience: AUDIENCE,
      type: CONTROL_NATIVE_TOKEN_TYPE,
      issuedAt: new Date(iat * 1000),
    }
  )
  return { access_token: token, token_type: 'Bearer', expires_at: exp * 1000 }
}

export async function verifyControlNativeToken(
  token: string,
  secret: string,
  issuer: string
) {
  if (!issuer || !secret)
    throw new Error('Missing native authentication configuration')
  const claims = await verifyJWT(token, nativeSigningKey(secret), {
    issuer: new URL(issuer).origin,
    audience: AUDIENCE,
    type: CONTROL_NATIVE_TOKEN_TYPE,
    requiredClaims: ['sub', 'iat', 'exp', 'iss', 'aud'],
    clockTolerance: 0,
  })
  const now = Math.floor(Date.now() / 1000)
  if (
    claims.role !== 'USER' ||
    claims.purpose !== 'lecturer-control' ||
    (claims.scope !== 'SESSION_EXEC' && claims.scope !== 'READ_ONLY') ||
    !isControlNativeSource(claims.source) ||
    !claims.sub ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.iat! > now + 60 ||
    claims.exp! <= now ||
    claims.exp! <= claims.iat! ||
    claims.exp! - claims.iat! > SESSION_MAX_AGE_SECONDS
  )
    throw new Error('Invalid native claims')
  return claims as ControlNativeClaims
}

export function controlNativeScope(scope: unknown): ControlNativeScope | null {
  switch (scope) {
    case 'ACCOUNT_OWNER':
    case 'FULL_ACCESS':
    case 'SESSION_EXEC':
      return 'SESSION_EXEC'
    case 'READ_ONLY':
      return 'READ_ONLY'
    default:
      return null
  }
}

export function isControlNativeSource(
  value: unknown
): value is ControlNativeSource {
  if (!value || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  return (
    typeof source.id === 'string' &&
    source.id.length > 0 &&
    (source.kind === 'institutional' ||
      (source.kind === 'delegated' &&
        typeof source.passwordDigest === 'string' &&
        /^[a-f0-9]{64}$/.test(source.passwordDigest)))
  )
}
