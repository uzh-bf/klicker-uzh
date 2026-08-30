import { isKnownTourId } from '@klicker-uzh/product-tours'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTourParticipantId } from '@/src/lib/server/apiGuards'
import { getTourState, markTourCompleted } from '@/src/services/tours'

// Not scoped to a chatbot: a tour explains the chat application itself, so what
// a participant has already seen holds for every bot they open. The route sits
// beside the chatbot tree for the same reason the product-update route does.

const bodySchema = z.object({
  tourId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const authResult = await getTourParticipantId(req)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  const tourId = req.nextUrl.searchParams.get('tourId')

  // Tours live in code and the stored `tourId` has no foreign key, so an
  // unrecognized id is named rather than answered with an empty state: a client
  // asking about a tour this build does not know would otherwise read the
  // silence as "never completed" and open an overlay for it.
  if (!tourId || !isKnownTourId(tourId)) {
    return NextResponse.json({ error: 'Unknown tour id' }, { status: 400 })
  }

  try {
    const state = await getTourState(participantId, tourId)
    return NextResponse.json(state)
  } catch (error) {
    console.error('Failed to fetch tour state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tour state' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const authResult = await getTourParticipantId(req)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  // `req.json()` throws on a body that is not JSON at all, so it is read in its
  // own guarded step: inside the write `try` below the same client mistake would
  // surface as a 500 instead of the deliberate 400 that follows it.
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { tourId } = parsed.data

  if (!isKnownTourId(tourId)) {
    return NextResponse.json(
      { error: `Unknown tour id: ${tourId}` },
      { status: 400 }
    )
  }

  try {
    const state = await markTourCompleted(participantId, tourId)
    return NextResponse.json(state)
  } catch (error) {
    console.error('Failed to record tour completion:', error)
    return NextResponse.json(
      { error: 'Failed to record tour completion' },
      { status: 500 }
    )
  }
}
