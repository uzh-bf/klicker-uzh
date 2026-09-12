import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import {
  type ChatbotKnowledgeGraphReadRequest,
  isKnowledgeGraphNotPublishedError,
  KnowledgeGraphBuildChangedError,
  KnowledgeGraphSelectionRequiredError,
  readPublishedChatbotKnowledgeGraph,
} from '@/src/lib/server/knowledgeGraph'
import { createKnowledgeGraphAdmission } from '@/src/services/knowledgeGraphAdmission'

export const runtime = 'nodejs'

const operationSchema = z.enum(['overview', 'search', 'neighbors'])
const searchQuerySchema = z.string().trim().min(1).max(100)
const nodeIdSchema = z.string().regex(/^\d{1,20}$/)
const admission = createKnowledgeGraphAdmission()

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
    const kbId = z
      .string()
      .uuid()
      .safeParse(req.nextUrl.searchParams.get('kbId'))
    const buildId = z
      .string()
      .uuid()
      .safeParse(req.nextUrl.searchParams.get('buildId'))
    return nodeId.success && kbId.success && buildId.success
      ? {
          operation: 'neighbors',
          nodeId: nodeId.data,
          kbId: kbId.data,
          buildId: buildId.data,
        }
      : null
  }

  return { operation: 'overview' }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }

  // A disabled map exposes no graph data. It is not a participation failure,
  // so it carries its own code instead of the participation-required response.
  if (!authResult.chatbot.knowledgeGraphVisible) {
    return NextResponse.json(
      {
        code: 'KNOWLEDGE_GRAPH_DISABLED',
        error: 'Knowledge graph is disabled for this chatbot',
      },
      { status: 403 }
    )
  }

  const readRequest = parseReadRequest(req)
  if (readRequest === null) {
    return invalidRequestResponse()
  }

  const kbId = z
    .string()
    .uuid()
    .optional()
    .safeParse(req.nextUrl.searchParams.get('kbId') ?? undefined)
  if (!kbId.success) return invalidRequestResponse()
  if (kbId.data !== undefined) readRequest.kbId = kbId.data

  const slot = admission.acquire(authResult.participantId)
  if (!slot.allowed) {
    return NextResponse.json(
      {
        code: 'KNOWLEDGE_GRAPH_BUSY',
        error: 'Please wait before trying again',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(slot.retryAfterSeconds),
          'Cache-Control': 'private, no-store',
        },
      }
    )
  }

  try {
    const response = await readPublishedChatbotKnowledgeGraph(
      chatbotId,
      readRequest
    )
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof KnowledgeGraphBuildChangedError) {
      return NextResponse.json(
        {
          code: 'KNOWLEDGE_GRAPH_BUILD_CHANGED',
          error: 'Reload the knowledge graph',
        },
        { status: 409 }
      )
    }
    if (error instanceof KnowledgeGraphSelectionRequiredError) {
      return NextResponse.json(
        { code: 'KNOWLEDGE_GRAPH_SELECTION_REQUIRED', choices: error.choices },
        { status: 409 }
      )
    }
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

    console.error('Participant knowledge graph read failed', {
      chatbotId,
      operation: readRequest.operation,
    })
    return NextResponse.json(
      {
        code: 'KNOWLEDGE_GRAPH_TEMPORARILY_UNAVAILABLE',
        error: 'Knowledge graph is temporarily unavailable',
      },
      { status: 503 }
    )
  } finally {
    slot.release()
  }
}
