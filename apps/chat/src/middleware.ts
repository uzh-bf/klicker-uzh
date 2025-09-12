// nextjs middleware that redirects to login if no participant_token cookie is set
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const participantToken = request.cookies.get('participant_token')?.value

  if (!participantToken) {
    return NextResponse.redirect('https://pwa.klicker.com', 302)
  }

  // verify with jose that the token is valid
  // if not valid, redirect to pwa.klicker.com
  // if valid, continue
  try {
    await jwtVerify(
      participantToken || '',
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
  } catch (error) {
    console.error('Invalid participant token:', error)
    return NextResponse.redirect(process.env.NEXT_PUBLIC_PWA_URL as string, 302)
  }

  // TODO: relay participant data to api routes or similar

  return NextResponse.next()
}

// Paths that should be protected by this middleware
export const config = {
  matcher: ['/:path*'],
}
