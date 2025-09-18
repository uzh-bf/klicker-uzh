// nextjs middleware that redirects to login if no participant_token cookie is set
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const participantToken = request.cookies.get('participant_token')?.value

  const loginUrl = `${process.env.NEXT_PUBLIC_PWA_URL}/login?redirectTo=${process.env.NEXT_PUBLIC_CHAT_URL}`

  if (!participantToken) {
    return NextResponse.redirect(loginUrl, 302)
  }

  // verify with jose that the token is valid
  // if not valid, redirect to login with redirectTo
  try {
    await jwtVerify(
      participantToken || '',
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
  } catch (error) {
    console.error('Invalid participant token:', error)
    return NextResponse.redirect(loginUrl, 302)
  }

  // TODO: relay participant data to api routes or similar

  return NextResponse.next()
}

// Paths that should be protected by this middleware
export const config = {
  matcher: ['/:path*'],
}
