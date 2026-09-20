// JWT encode/decode for NextAuth in the auth service.
//
// NextAuth calls the configured jwt.encode/decode for two distinct purposes:
//
//  1. Session tokens — called WITHOUT a salt. These must stay HS256 JWTs
//     signed with APP_SECRET and the APP_ORIGIN_AUTH issuer, because the
//     backend (apps/backend-docker jwtMiddleware) verifies them with
//     verifyJWT(token, APP_SECRET).
//  2. Temporary OAuth cookies (state, PKCE verifier, nonce) — called WITH a
//     salt equal to the cookie name (core/lib/oauth/checks.js). These are
//     delegated to next-auth's default implementation, an A256GCM JWE whose
//     key is HKDF-derived from (secret, salt). The salt binding is what makes
//     a state cookie issued under one audience's cookie name undecryptable
//     under another audience's name, and next-auth's decoder enforces the
//     embedded expiry on verification.
//
// The payload of a temporary cookie is { value, provider } — the provider
// identity written by next-auth itself, which the callback dispatch checks.

import type { JWTPayload } from '@klicker-uzh/util'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import type {
  DefaultJWT,
  JWTDecodeParams,
  JWTEncodeParams,
} from 'next-auth/jwt'
import {
  decode as defaultJwtDecode,
  encode as defaultJwtEncode,
} from 'next-auth/jwt'

export async function encode({ token, secret, salt, maxAge }: JWTEncodeParams) {
  const secretString = typeof secret === 'string' ? secret : secret.toString()
  if (salt) {
    return defaultJwtEncode({ token, secret: secretString, salt, maxAge })
  }
  return signJWT((token as JWTPayload) ?? {}, secretString, {
    issuer: process.env.APP_ORIGIN_AUTH,
  })
}

export async function decode({ token, secret, salt }: JWTDecodeParams) {
  if (!token) return null
  const secretString = typeof secret === 'string' ? secret : secret.toString()
  if (salt) {
    return defaultJwtDecode({ token, secret: secretString, salt })
  }
  return (await verifyJWT(token, secretString, {
    issuer: process.env.APP_ORIGIN_AUTH,
  })) as DefaultJWT
}
