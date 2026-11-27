import type { AppLogger } from '@klicker-uzh/logging/node'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { createLoggedRoute } from '@/src/lib/server/requestLogging'
import { buildExplanationPage } from '@/src/services/explainerService'

export const runtime = 'nodejs'

/**
 * Builds the page for an explanation shown in a chat message. The message
 * stores only the content; the page is built on demand by the Catalyst
 * explainer service, which validates the content again.
 */
async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
  log: AppLogger
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
  if ('response' in authResult) return authResult.response
  // The prototype flag turns the proxy off too, so a configured service is
  // not reachable while explanations are disabled.
  if (process.env.CHAT_EXPLANATION_TOOL !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // The service refuses bodies above 300 KB; refuse them before parsing.
  if (Number(req.headers.get('content-length') ?? 0) > 300_000) {
    return NextResponse.json({ error: 'Content too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const content = (body as { content?: unknown } | null)?.content
  if (!content || typeof content !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const page = await buildExplanationPage(content)
    if (!page) {
      return NextResponse.json(
        { error: 'Explanation service unavailable' },
        { status: 503 }
      )
    }
    if ('errors' in page) {
      return NextResponse.json({ errors: page.errors }, { status: 422 })
    }
    return NextResponse.json({ html: page.html })
  } catch {
    return NextResponse.json(
      { error: 'Explanation service unavailable' },
      { status: 503 }
    )
  }
}

export const POST = createLoggedRoute(
  '/api/chatbots/:chatbotId/explanations/page',
  handlePOST
)
