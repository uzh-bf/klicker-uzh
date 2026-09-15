import { NextResponse } from 'next/server'
import { withRouteLogging } from '@/src/lib/server/requestLogging'

async function handleGET() {
  return NextResponse.json(
    {
      status: 'OK',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}

export function GET(request: Request) {
  return withRouteLogging(request, '/api/health', handleGET)
}
