// OAuth 2.1 token endpoint for the klicker-mcp server.
//
// Exchanges a one-time authorization code (issued by /api/mcp/authorize)
// for a KlickerUZH JWT the MCP proxy can present as its access token.
//
// The MCP proxy calls this server-to-server — the MCP client never sees
// the KlickerUZH JWT. Client authentication is checked against env-pinned
// `MCP_UPSTREAM_CLIENT_ID` / `MCP_UPSTREAM_CLIENT_SECRET`; PKCE proves the
// exchange comes from the same client that started the flow.
//
// No refresh-token path for the POC: proxy is expected to re-run the
// browser dance (the user's NextAuth cookie typically makes this silent).

import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { MCP_ACCESS_TOKEN_TTL_SECONDS } from './_constants'
import { popCode, type CodeRecord } from './_store'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const body = req.body as Record<string, string | undefined>
  const {
    grant_type: grantType,
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  } = body

  if (grantType !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' })
    return
  }
  if (!code || !codeVerifier || !clientId || !clientSecret || !redirectUri) {
    res.status(400).json({ error: 'invalid_request' })
    return
  }

  if (
    clientId !== process.env.MCP_UPSTREAM_CLIENT_ID ||
    clientSecret !== process.env.MCP_UPSTREAM_CLIENT_SECRET
  ) {
    res.status(401).json({ error: 'invalid_client' })
    return
  }

  let record: CodeRecord | null
  try {
    record = await popCode(code)
  } catch (error) {
    console.error('Failed to retrieve MCP OAuth authorization code', error)
    res.status(503).json({ error: 'temporarily_unavailable' })
    return
  }
  if (!record) {
    res
      .status(400)
      .json({ error: 'invalid_grant', reason: 'code expired or unknown' })
    return
  }
  if (record.redirectUri !== redirectUri || record.clientId !== clientId) {
    res.status(400).json({ error: 'invalid_grant', reason: 'binding mismatch' })
    return
  }

  // S256: expected challenge = base64url(sha256(verifier))
  const digest = crypto.createHash('sha256').update(codeVerifier).digest()
  const computedChallenge = digest.toString('base64url')
  if (computedChallenge !== record.codeChallenge) {
    res.status(400).json({ error: 'invalid_grant', reason: 'pkce mismatch' })
    return
  }

  res.status(200).json({
    access_token: record.jwt,
    token_type: 'Bearer',
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
  })
}
