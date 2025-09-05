import JWT from 'jsonwebtoken'
import type { NextAuthConfig } from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'

export const COOKIE_NAME = 'next-auth.session-token'

export async function decode({ token, secret }: JWTDecodeParams) {
  if (!token) return null
  return JWT.verify(token, secret) as DefaultJWT
}

export async function encode({ token, secret }: JWTEncodeParams) {
  return JWT.sign(token ?? '', secret)
}

export const authOptions = {
  secret: process.env.APP_SECRET,

  providers: [],

  session: {
    strategy: 'jwt',
  },

  jwt: {
    decode,
    encode,
  },

  cookies: {
    // csrfToken: {
    //   name: 'next-auth.csrf-token',
    //   options: {
    //     domain: process.env.COOKIE_DOMAIN,
    //     // path: '/',
    //     // httpOnly: true,
    //     // sameSite: 'lax',
    //     // secure: process.env.NODE_ENV === 'production',
    //   },
    // },
    sessionToken: {
      name: COOKIE_NAME,
      options: {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
}

export default authOptions satisfies NextAuthConfig
