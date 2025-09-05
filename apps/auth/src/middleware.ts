import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import authConfig from './auth.config'

const { auth } = NextAuth(authConfig)
export default auth(async function middleware(req: NextRequest) {
  // custom middleware logic
})
