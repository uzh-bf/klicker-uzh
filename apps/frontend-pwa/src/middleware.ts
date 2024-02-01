import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  if (process.env.DEBUG) {
    console.log(JSON.stringify(request.nextUrl))
  }
  return response
}
