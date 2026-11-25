import {
  extractBearerToken,
  verifyResponseExampleBaselineJob,
} from '@klicker-uzh/util/auth'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readBoundedJson } from '@/src/lib/server/manageChatRequest'
import { executeResponseExampleBaselineCase } from '@/src/lib/server/responseExampleBaseline'

export const runtime = 'nodejs'
export const maxDuration = 120
const scopeSchema = z
  .object({
    ownerId: z.string().guid(),
    chatbotId: z.string().guid(),
    runId: z.string().guid(),
    caseId: z.string().guid(),
  })
  .strict()

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await readBoundedJson(req, 4096, AbortSignal.timeout(5000))
  const scope = body.ok ? scopeSchema.safeParse(body.value) : null
  if (!scope?.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    await verifyResponseExampleBaselineJob(
      token,
      scope.data,
      process.env.RESPONSE_EXAMPLE_BASELINE_JOB_SECRET
    )
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await executeResponseExampleBaselineCase(scope.data)
  return NextResponse.json(result)
}
