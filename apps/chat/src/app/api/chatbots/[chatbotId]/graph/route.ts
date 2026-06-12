import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { getChatbotGraphSnapshot } from '@klicker-uzh/falkordb'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const graphQuerySchema = z.object({
  edgeLimit: z.coerce.number().int().min(1).max(500).default(150),
  nodeLimit: z.coerce.number().int().min(1).max(500).default(100),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }

  const parsedQuery = graphQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  )
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid graph query parameters' },
      { status: 400 }
    )
  }

  try {
    const snapshot = await getChatbotGraphSnapshot({
      chatbotId,
      edgeLimit: parsedQuery.data.edgeLimit,
      nodeLimit: parsedQuery.data.nodeLimit,
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    if (isFalkorDBConfigurationError(error)) {
      return NextResponse.json(
        { error: 'FalkorDB is not configured for this environment' },
        { status: 503 }
      )
    }

    console.error('Failed to load chatbot graph snapshot:', error)
    return NextResponse.json(
      { error: 'Failed to load chatbot graph snapshot' },
      { status: 500 }
    )
  }
}

function isFalkorDBConfigurationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return /FALKORDB_/i.test(message)
}
