import type { AppLogger } from '@klicker-uzh/logging/node'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import {
  type ChatbotKnowledgeGraphReadRequest,
  isKnowledgeGraphNotPublishedError,
  readPublishedChatbotKnowledgeGraph,
} from '@/src/lib/server/knowledgeGraph'
import { withRouteLogging } from '@/src/lib/server/requestLogging'

export const runtime = 'nodejs'

const operationSchema = z.enum(['overview', 'search', 'neighbors'])
const searchQuerySchema = z.string().trim().min(1).max(100)
const nodeIdSchema = z.string().regex(/^\d+$/)

function invalidRequestResponse() {
  return NextResponse.json(
    {
      code: 'INVALID_KNOWLEDGE_GRAPH_REQUEST',
      error: 'Invalid knowledge graph request',
    },
    { status: 400 }
  )
}

function parseReadRequest(
  req: NextRequest
): ChatbotKnowledgeGraphReadRequest | null {
  const operation = operationSchema.safeParse(
    req.nextUrl.searchParams.get('operation')
  )
  if (!operation.success) {
    return null
  }

  if (operation.data === 'search') {
    const query = searchQuerySchema.safeParse(req.nextUrl.searchParams.get('q'))
    return query.success ? { operation: 'search', query: query.data } : null
  }

  if (operation.data === 'neighbors') {
    const nodeId = nodeIdSchema.safeParse(
      req.nextUrl.searchParams.get('nodeId')
    )
    return nodeId.success
      ? { operation: 'neighbors', nodeId: nodeId.data }
      : null
  }

  return { operation: 'overview' }
}

async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
  log: AppLogger
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
  if ('response' in authResult) {
    return authResult.response
  }

  const readRequest = parseReadRequest(req)
  if (readRequest === null) {
    return invalidRequestResponse()
  }

  try {
    const response = await readPublishedChatbotKnowledgeGraph(
      chatbotId,
      readRequest
    )
    return NextResponse.json(response)
  } catch (error) {
    if (isKnowledgeGraphNotPublishedError(error)) {
      return NextResponse.json(
        {
          code: 'KNOWLEDGE_GRAPH_NOT_PUBLISHED',
          error: 'Knowledge graph is not published',
          publicationStatus: error.code,
        },
        { status: 409 }
      )
    }

    log.error(
      { event: 'chat.knowledge_graph.read.failed' },
      'Participant knowledge graph read failed'
    )
    return NextResponse.json(
      {
        code: 'KNOWLEDGE_GRAPH_TEMPORARILY_UNAVAILABLE',
        error: 'Knowledge graph is temporarily unavailable',
      },
      { status: 503 }
    )
  }
}

export function GET(
  req: NextRequest,
  context: { params: Promise<{ chatbotId: string }> }
) {
  return withRouteLogging(
    req,
    '/api/chatbots/:chatbotId/knowledge-graph',
    (log) => handleGET(req, context, log)
  )
}
