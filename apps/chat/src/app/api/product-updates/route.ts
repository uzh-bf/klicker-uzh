import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProductUpdateParticipantId } from '@/src/lib/server/apiGuards'
import {
  dismissProductUpdate,
  getChatProductUpdates,
  isKnownUpdateId,
  markProductUpdateRead,
  recordProductUpdatePresentation,
} from '@/src/services/productUpdates'

// Not scoped to a chatbot: product updates are addressed to the person, not to
// the course they are chatting with, so this route sits beside the chatbot tree
// rather than inside it.

const bodySchema = z.object({
  updateId: z.string().min(1),
  action: z.enum(['read', 'dismiss', 'presented']),
})

// The active locale lives in the `NEXT_LOCALE` cookie; chat has no `[locale]`
// route segment. Anything unrecognized falls back to the default locale.
function localeOf(req: NextRequest): string {
  return req.cookies.get('NEXT_LOCALE')?.value === 'de' ? 'de' : 'en'
}

export async function GET(req: NextRequest) {
  const authResult = await getProductUpdateParticipantId(req)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const updates = await getChatProductUpdates(participantId, localeOf(req))
    return NextResponse.json({ updates })
  } catch (error) {
    console.error('Failed to fetch product updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product updates' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const authResult = await getProductUpdateParticipantId(req)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    const { updateId, action } = parsed.data

    // `updateId` has no foreign key because the catalog lives in code, so an
    // unknown id would otherwise create an orphaned row that no surface can
    // ever display or clean up. The read path filters unknown ids silently for
    // rollout tolerance; a write names them instead.
    if (!isKnownUpdateId(updateId)) {
      return NextResponse.json(
        { error: `Unknown product update id: ${updateId}` },
        { status: 400 }
      )
    }

    if (action === 'read') {
      await markProductUpdateRead(participantId, updateId)
    } else if (action === 'dismiss') {
      await dismissProductUpdate(participantId, updateId)
    } else {
      await recordProductUpdatePresentation(participantId, updateId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to update product update state:', error)
    return NextResponse.json(
      { error: 'Failed to update product update state' },
      { status: 500 }
    )
  }
}
