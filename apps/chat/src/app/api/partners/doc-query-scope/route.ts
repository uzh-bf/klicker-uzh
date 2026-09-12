import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS,
  signDocQueryScopeToken,
} from '@/src/lib/server/docQueryScopeToken'
import { resolvePartnerId } from '@/src/lib/server/partnerAuth'
import { resolveMcpScope } from '@/src/services/mcpScope'

const requestSchema = z.object({
  chatbotId: z.string().uuid(),
  sessionRef: z.string().trim().min(1).max(200).optional(),
})

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json(
    { error, ...(code ? { code } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * Issues a short-lived Doc Query scope token to an authenticated partner
 * service for one owner-approved chatbot. The knowledge-base scope, chatbot
 * identity and display metadata are derived from server state only; the
 * caller can never widen the scope or impersonate a participant thread.
 */
export async function POST(request: NextRequest) {
  const partnerId = resolvePartnerId(request)
  if (!partnerId) {
    return jsonError('Partner authentication failed', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid request body', 400)
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('Invalid request body', 400)
  }
  const { chatbotId, sessionRef } = parsed.data

  const grant = await prisma.partnerChatbotGrant.findUnique({
    where: { partnerId_chatbotId: { partnerId, chatbotId } },
    select: { revokedAt: true },
  })
  if (!grant) {
    return jsonError('Chatbot not found', 404)
  }
  if (grant.revokedAt) {
    return jsonError('Partner access revoked', 403, 'PARTNER_ACCESS_REVOKED')
  }

  const chatbot = await prisma.chatbot.findUnique({
    where: {
      id: chatbotId,
      course: { deletionRequestedAt: null },
    },
    select: {
      id: true,
      name: true,
      courseId: true,
      status: true,
      owner: { select: { aiFeaturesEnabled: true } },
      mcpConfigurations: {
        where: { isEnabled: { not: false } },
        select: {
          chatMode: true,
          parameters: true,
          mcpServer: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!chatbot || chatbot.status !== ChatbotStatus.PUBLISHED) {
    return jsonError('Chatbot not found', 404)
  }
  if (!chatbot.owner.aiFeaturesEnabled) {
    return jsonError('AI usage is not authorized', 403, 'AI_FEATURES_DISABLED')
  }

  const configurations = chatbot.mcpConfigurations
  let kbIds: string[]
  try {
    const resolved = resolveMcpScope(configurations, 'default', configurations)
    if (!resolved) {
      return jsonError(
        'No scoped knowledge base configured',
        409,
        'SCOPE_UNAVAILABLE'
      )
    }
    kbIds = resolved
  } catch {
    return jsonError(
      'Scoped knowledge retrieval is not available',
      409,
      'SCOPE_UNAVAILABLE'
    )
  }

  const pwaBase = process.env.NEXT_PUBLIC_PWA_URL?.replace(/\/$/, '')
  const chatbotUrl = pwaBase
    ? `${pwaBase}/course/${chatbot.courseId}/chatbot/${chatbot.id}/chat`
    : undefined

  const token = await signDocQueryScopeToken({
    kbIds,
    chatbotId: chatbot.id,
    sessionId: sessionRef ?? `partner:${partnerId}`,
    jti: randomUUID(),
    partnerId,
    chatbotName: chatbot.name,
    chatbotUrl,
  })

  try {
    await prisma.partnerChatbotGrant.update({
      where: { partnerId_chatbotId: { partnerId, chatbotId } },
      data: { lastUsedAt: new Date() },
      select: { id: true },
    })
  } catch {
    // Usage bookkeeping must never block a valid issuance.
  }

  return NextResponse.json(
    { token, expiresIn: DOC_QUERY_SCOPE_TOKEN_TTL_SECONDS },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
