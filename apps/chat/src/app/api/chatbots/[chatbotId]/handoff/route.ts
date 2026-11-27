import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { signChatTabHandoffToken } from '@/src/lib/server/pwaEmbed'

const bodySchema = z.object({
  threadId: z.string().guid().optional(),
})

/**
 * Mint a short-lived handoff URL that opens this chatbot in a new browser tab
 * with the same identity the caller has here. A framed chat's session lives in
 * cookies partitioned to the host site (or in sessionStorage), so the new tab
 * cannot reuse it directly.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }

  const body = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { participantId, authMode, learnerBinding, chatbot } = authResult
  const token = await signChatTabHandoffToken({
    participantId,
    kind: authMode === 'anonymous' ? 'guest' : 'account',
    chatbotId,
    courseId: chatbot.courseId,
    learnerBinding,
  })

  const url = new URLSearchParams({ token })
  if (body.data.threadId) url.set('threadId', body.data.threadId)

  return NextResponse.json(
    { url: `/auth/handoff?${url.toString()}` },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
