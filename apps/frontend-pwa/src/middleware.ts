import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // TODO: if the requester has an LTI cookie -> skip everything else and redirect to the requested element
  // TODO: if the requester has no cookie yet -> call the backend and request an account
  // TODO: if a new account has been created, a cookie has been set for the backend -> redirect to the welcome page
  // TODO: if the account existed, a cookie has been set for the backend -> redirect to the requested element
  return NextResponse.redirect(new URL(request.url))
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/course/:path*',
}
