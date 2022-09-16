import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // if the requester has a login cookie -> skip everything else and redirect to the requested element
  if (request.cookies.get('participant_token')) {
    return NextResponse.next()
  }

  // TODO: if the requester has no cookie yet -> call the backend and request an account
  // TODO: if a new account has been created, a cookie has been set for the backend -> redirect to the welcome page
  // TODO: if the account existed, a cookie has been set for the backend -> redirect to the requested element
  return NextResponse.next()
}

export const config = {
  matcher: '/course/:path*',
}
