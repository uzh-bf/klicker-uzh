import type { AppLogger } from '@klicker-uzh/logging/node'
import {
  FlashcardCorrectness,
  STUDENT_MCP_SUPPORTED_ELEMENT_TYPES,
} from '@klicker-uzh/types'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'
import {
  StudentPracticeMcpToolError,
  statusForStudentPracticeMcpError,
  submitPracticeStackAnswer,
} from '@/src/services/studentPracticeMcp'

export const runtime = 'nodejs'

const stackResponseSchema = z.object({
  choicesResponse: z
    .array(
      z.object({
        ix: z.number().int(),
        selected: z.boolean(),
      })
    )
    .optional(),
  flashcardResponse: z.nativeEnum(FlashcardCorrectness).optional(),
  freeTextResponse: z.string().optional(),
  instanceId: z.number().int(),
  numericalResponse: z.number().optional(),
  type: z.enum(STUDENT_MCP_SUPPORTED_ELEMENT_TYPES),
})

const bodySchema = z.object({
  questionRef: z.string().min(1),
  responses: z.array(stackResponseSchema).min(1),
  stackAnswerTimeSeconds: z.number().int().min(0),
})

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
  log: AppLogger
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
  if ('response' in authResult) {
    return authResult.response
  }

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

  try {
    const result = await submitPracticeStackAnswer({
      authMode: authResult.authMode,
      chatbotId,
      participantId: authResult.participantId,
      questionRef: parsed.data.questionRef,
      responses: parsed.data.responses,
      stackAnswerTimeSeconds: parsed.data.stackAnswerTimeSeconds,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Student practice MCP is not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    log.error(
      { event: 'chat.student_practice.submit.failed' },
      'Failed to submit student practice answer'
    )

    if (error instanceof StudentPracticeMcpToolError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: statusForStudentPracticeMcpError(error) }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit practice answer' },
      { status: 500 }
    )
  }
}

export function POST(
  req: NextRequest,
  context: { params: Promise<{ chatbotId: string }> }
) {
  return withRouteLogging(
    req,
    '/api/chatbots/:chatbotId/practice/submit',
    (log) => handlePOST(req, context, log)
  )
}
