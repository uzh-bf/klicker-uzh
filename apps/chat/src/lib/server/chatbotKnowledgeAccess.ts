import { prisma } from '@klicker-uzh/prisma'
import { ObjectType } from '@klicker-uzh/prisma/client'
import {
  getPositiveObjectPermission,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import { normalizeDocQueryKbIds } from '@/src/services/mcpScope'
import { authorizeIdentityForChatbot, type AuthMode } from './apiGuards'
import { RequiredMCPUnavailableError } from './mcpRuntimePolicy'

type KnowledgeAccessPrisma = PrismaTransactionClient
type ParticipantAuthorizer = typeof authorizeIdentityForChatbot

export interface ChatbotKnowledgeAccessInput {
  chatbotId: string
  kbIds: readonly string[]
  participantId?: string
  ownerPreviewUserId?: string
  authMode?: AuthMode
  courseId?: string
}

export interface ChatbotKnowledgeAccessDependencies {
  client?: KnowledgeAccessPrisma
  authorizeParticipant?: ParticipantAuthorizer
}

function denyKnowledgeAccess(): never {
  throw new RequiredMCPUnavailableError('scope_violation')
}

function sameOrderedIds(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

/**
 * Re-resolves the live chatbot binding and the bot owner's effective KB level.
 * The enabled, non-deleted binding set must equal the request's captured scope
 * exactly, so a removed or newly added binding cannot silently change a turn.
 * Same-owner KBs are accepted from the binding row. Cross-owner KBs require a
 * positive current direct or group grant; DerivedPermission can lag a change.
 */
export async function assertCurrentChatbotKnowledgeAccess(
  input: ChatbotKnowledgeAccessInput,
  dependencies: ChatbotKnowledgeAccessDependencies = {}
) {
  const client = dependencies.client ?? prisma
  const authorizeParticipant =
    dependencies.authorizeParticipant ?? authorizeIdentityForChatbot
  const expectedKbIds = normalizeDocQueryKbIds([...input.kbIds])

  if (input.ownerPreviewUserId !== undefined) {
    if (input.participantId !== undefined) denyKnowledgeAccess()
  } else if (input.participantId !== undefined) {
    if (!input.authMode || !input.courseId) denyKnowledgeAccess()
    const authorization = await authorizeParticipant(
      { participantId: input.participantId, authMode: input.authMode },
      input.chatbotId
    )
    if (
      'response' in authorization ||
      authorization.chatbot.courseId !== input.courseId
    ) {
      denyKnowledgeAccess()
    }
  }

  const chatbot = await client.chatbot.findUnique({
    where: { id: input.chatbotId },
    select: {
      ownerId: true,
      courseId: true,
      knowledgeGraphRetrievalEnabled: true,
      knowledgeBases: {
        where: { isEnabled: true, kb: { deletedAt: null } },
        select: {
          kbId: true,
          kb: { select: { ownerId: true, knowledgeGraphEnabled: true } },
        },
      },
    },
  })
  if (!chatbot) denyKnowledgeAccess()

  if (
    input.ownerPreviewUserId !== undefined &&
    chatbot.ownerId !== input.ownerPreviewUserId
  ) {
    denyKnowledgeAccess()
  }
  if (
    input.participantId !== undefined &&
    chatbot.courseId !== input.courseId
  ) {
    denyKnowledgeAccess()
  }

  const actualKbIds = chatbot.knowledgeBases
    .map(({ kbId }) => kbId)
    .sort((left, right) => left.localeCompare(right))
  if (!sameOrderedIds(actualKbIds, expectedKbIds)) denyKnowledgeAccess()

  const authorizedKbIds = new Set(
    chatbot.knowledgeBases
      .filter(({ kb }) => kb.ownerId === chatbot.ownerId)
      .map(({ kbId }) => kbId)
  )
  const crossOwnerKbIds = chatbot.knowledgeBases
    .filter(({ kb }) => kb.ownerId !== chatbot.ownerId)
    .map(({ kbId }) => kbId)

  if (crossOwnerKbIds.length > 0) {
    const permissionLevels = await Promise.all(
      crossOwnerKbIds.map((kbId) =>
        getPositiveObjectPermission(
          {
            objectType: ObjectType.KB,
            objectId: kbId,
            userId: chatbot.ownerId,
          },
          client
        )
      )
    )
    for (const [index, permissionLevel] of permissionLevels.entries()) {
      if (permissionLevel !== null) {
        authorizedKbIds.add(crossOwnerKbIds[index]!)
      }
    }
  }

  if (actualKbIds.some((kbId) => !authorizedKbIds.has(kbId))) {
    denyKnowledgeAccess()
  }

  return chatbot
}
