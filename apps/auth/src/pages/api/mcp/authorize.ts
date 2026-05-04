// OAuth 2.1 authorization endpoint for the klicker-mcp server.
//
// This is the upstream endpoint pointed to by FastMCP's OAuthProxy on the
// MCP server. The proxy handles DCR + PKCE with the MCP client; this
// endpoint only needs to:
//
// 1. Check the user has a valid NextAuth session (lecturer or participant
//    cookie). If not, bounce through the existing NextAuth sign-in flow
//    with a callbackUrl back here so the flow resumes after login.
// 2. Mint a one-time authorization code, bind it to the PKCE challenge the
//    caller sent, and stash the KlickerUZH JWT to be returned by /token.
// 3. Redirect to the caller's `redirect_uri` with `code` and the original
//    `state`.
//
// Production hardening (not required for the POC):
// - replace the in-process store with Redis
// - move to a signed authorization-code JWT so this can be stateless
// - show a branded consent page instead of relying on FastMCP's

import { MANAGER_COOKIE_NAME, PARTICIPANT_COOKIE_NAME } from '@/lib/constants'
import { decode } from '@/lib/helpers'
import { signJWT } from '@klicker-uzh/util'
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { MCP_ACCESS_TOKEN_TTL } from './_constants'
import { putCode } from './_store'

const REQUIRED_PARAMS = [
  'client_id',
  'redirect_uri',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const params = req.query as Record<string, string | undefined>
  for (const name of REQUIRED_PARAMS) {
    if (!params[name]) {
      res.status(400).json({ error: 'invalid_request', missing: name })
      return
    }
  }
  if (params.code_challenge_method !== 'S256') {
    res
      .status(400)
      .json({ error: 'invalid_request', reason: 'only S256 PKCE supported' })
    return
  }

  const expectedClientId = process.env.MCP_UPSTREAM_CLIENT_ID
  if (!expectedClientId || params.client_id !== expectedClientId) {
    res.status(401).json({ error: 'invalid_client' })
    return
  }

  // OAuth scope is a space- or comma-separated list of tokens; match on
  // exact tokens to avoid substring collisions like `participant_preview`.
  const scopes = (params.scope ?? 'lecturer').toLowerCase().split(/[\s,]+/)
  const wantsParticipant = scopes.includes('participant')
  const cookieName = wantsParticipant
    ? PARTICIPANT_COOKIE_NAME
    : MANAGER_COOKIE_NAME

  const session = await getToken({
    req,
    decode,
    cookieName,
    secret: process.env.APP_SECRET,
  })

  if (!session || !session.sub) {
    // Send the user through NextAuth sign-in, then resume this endpoint.
    const callbackUrl = new URL(
      `${process.env.APP_ORIGIN_AUTH}/api/mcp/authorize`
    )
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string') callbackUrl.searchParams.set(k, v)
    }
    const signinUrl = new URL(`${process.env.APP_ORIGIN_AUTH}/api/auth/signin`)
    signinUrl.searchParams.set('callbackUrl', callbackUrl.toString())
    if (wantsParticipant) signinUrl.searchParams.set('participant', 'true')
    res.redirect(302, signinUrl.toString())
    return
  }

  // Re-sign a KlickerUZH JWT from the session payload. The backend
  // `jwtMiddleware` accepts any HS256/APP_SECRET-signed token with the
  // same claims shape that NextAuth already uses.
  const accessToken = await signJWT(
    {
      sub: session.sub,
      role: session.role as string | undefined,
      scope: session.scope as string | undefined,
      email: session.email ?? undefined,
      catalystInstitutional:
        (session.catalystInstitutional as boolean) ?? false,
      catalystIndividual: (session.catalystIndividual as boolean) ?? false,
    },
    process.env.APP_SECRET as string,
    { expiresIn: MCP_ACCESS_TOKEN_TTL, issuer: process.env.APP_ORIGIN_AUTH }
  )

  const code = crypto.randomBytes(32).toString('base64url')
  putCode(code, {
    jwt: accessToken,
    codeChallenge: params.code_challenge as string,
    codeChallengeMethod: 'S256',
    redirectUri: params.redirect_uri as string,
    clientId: params.client_id as string,
  })

  const redirectUrl = new URL(params.redirect_uri as string)
  redirectUrl.searchParams.set('code', code)
  redirectUrl.searchParams.set('state', params.state as string)
  res.redirect(302, redirectUrl.toString())
}
