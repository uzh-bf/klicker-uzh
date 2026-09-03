import { RESPONSE_EXAMPLE_RECEIPT_MAX_TOKEN_CHARACTERS } from '@klicker-uzh/util/response-example-receipt'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readBoundedJson } from '@/src/lib/server/manageChatRequest'
import { withOwnerPreviewAuth } from '@/src/lib/server/ownerPreviewAuth'
import { getRequiredManageOrigin } from '@/src/services/manageProposals'
import { createRateLimiter } from '@/src/services/rateLimiter'
import {
  captureResponseExampleThroughManage,
  ResponseExampleCaptureRequestError,
} from '@/src/services/responseExampleCapture'

export const runtime = 'nodejs'

const CAPTURE_MAX_BODY_BYTES = 64 * 1024
const captureRateLimiter = createRateLimiter(20, 5 * 60 * 1000)

const captureRequestSchema = z.object({
  receipt: z.string().min(1).max(RESPONSE_EXAMPLE_RECEIPT_MAX_TOKEN_CHARACTERS),
  question: z.string().trim().min(1).max(4_000),
  answer: z.string().trim().min(1).max(20_000),
})

function getGraphqlEndpoint() {
  const origin = process.env.APP_ORIGIN_API?.replace(/\/$/, '')
  if (!origin) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_ORIGIN_API is required')
    }
    return 'http://localhost:3000/api/graphql'
  }
  return `${origin}/api/graphql`
}

const captureErrorStatus: Record<string, number> = {
  RESPONSE_EXAMPLE_RECEIPT_INVALID: 400,
  RESPONSE_EXAMPLE_RECEIPT_EXPIRED: 410,
  RESPONSE_EXAMPLE_CAPTURE_STALE: 409,
  RESPONSE_EXAMPLE_CAPTURE_UNAVAILABLE: 503,
  NOT_FOUND: 404,
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const auth = await withOwnerPreviewAuth(chatbotId)
  if ('response' in auth) return auth.response

  const rateLimit = captureRateLimiter.check(auth.userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1_000)),
        },
      }
    )
  }

  const body = await readBoundedJson(req, CAPTURE_MAX_BODY_BYTES)
  if (!body.ok) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = captureRequestSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('next-auth.session-token')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let graphqlEndpoint: string
  let manageOrigin: string
  try {
    graphqlEndpoint = getGraphqlEndpoint()
    manageOrigin = getRequiredManageOrigin()
  } catch (error) {
    console.error('Response-example capture misconfigured:', {
      chatbotId,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'Response-example capture is not configured' },
      { status: 503 }
    )
  }

  try {
    const result = await captureResponseExampleThroughManage({
      graphqlEndpoint,
      input: { chatbotId, ...parsed.data },
      manageOrigin,
      sessionToken,
    })
    return NextResponse.json({
      ...result,
      reviewUrl: `${manageOrigin}/resources/chatbots?chatbotId=${encodeURIComponent(chatbotId)}&view=advanced&responseExampleId=${encodeURIComponent(result.exampleId)}`,
    })
  } catch (error) {
    if (error instanceof ResponseExampleCaptureRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: captureErrorStatus[error.code ?? ''] ?? 502 }
      )
    }
    console.error('Response-example capture failed:', {
      chatbotId,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return NextResponse.json(
      { error: 'Response-example capture failed' },
      { status: 502 }
    )
  }
}
