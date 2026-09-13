import type * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import {
  assertKbMaterialConfirmation,
  getKbMaterialScopeFingerprint,
  KB_MATERIAL_NOTICE_VERSION,
  KB_MATERIAL_PURPOSE,
  type KbMaterialConfirmationInput,
} from '../lib/kbMaterialConfirmation.js'

type ScopeBinding = { chatbotId: string; courseId: string | null }

export async function getKbMaterialScope(
  prisma: DB.Prisma.TransactionClient,
  kbId: string
): Promise<ScopeBinding[]> {
  const bindings = await prisma.kBChatbot.findMany({
    where: { kbId, isEnabled: true },
    select: { chatbotId: true, chatbot: { select: { courseId: true } } },
    orderBy: { chatbotId: 'asc' },
  })
  return bindings.map(({ chatbotId, chatbot }) => ({
    chatbotId,
    courseId: chatbot.courseId,
  }))
}

export async function recordKbMaterialConfirmation(
  prisma: DB.Prisma.TransactionClient,
  {
    kbId,
    actorId,
    confirmation,
    scope,
    ...material
  }: {
    kbId: string
    actorId: string
    confirmation: KbMaterialConfirmationInput
    scope: ScopeBinding[]
    resourceId?: string
    resourceVersion?: number
    sourceKey?: string
    chatbotId?: string
  }
) {
  assertKbMaterialConfirmation(confirmation)
  return prisma.kBMaterialConfirmation.create({
    data: {
      kbId,
      actorId,
      noticeVersion: KB_MATERIAL_NOTICE_VERSION,
      rightsConfirmed: true,
      personalDataConfirmed: true,
      purpose: KB_MATERIAL_PURPOSE,
      scopeFingerprint: getKbMaterialScopeFingerprint(scope),
      scopeSnapshot: JSON.stringify(scope),
      ...material,
    },
  })
}

export async function requireKbMaterialConfirmation(
  prisma: DB.Prisma.TransactionClient,
  {
    receiptId,
    kbId,
    actorId,
    sourceKey,
    resourceId,
  }: {
    receiptId: string | null
    kbId: string
    actorId: string
    sourceKey: string
    resourceId: string
  }
) {
  const receipt = receiptId
    ? await prisma.kBMaterialConfirmation.findUnique({
        where: { id: receiptId },
      })
    : null
  if (
    !receipt ||
    receipt.kbId !== kbId ||
    receipt.actorId !== actorId ||
    receipt.resourceId !== resourceId ||
    receipt.sourceKey !== sourceKey ||
    receipt.noticeVersion !== KB_MATERIAL_NOTICE_VERSION ||
    receipt.purpose !== KB_MATERIAL_PURPOSE ||
    !receipt.rightsConfirmed ||
    !receipt.personalDataConfirmed
  ) {
    throw new GraphQLError('Material confirmation is required', {
      extensions: { code: 'KB_MATERIAL_CONFIRMATION_REQUIRED' },
    })
  }
  const currentScope = await getKbMaterialScope(prisma, kbId)
  let confirmedScope: ScopeBinding[]
  try {
    const parsed: unknown = JSON.parse(receipt.scopeSnapshot)
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (binding) =>
          !binding ||
          typeof binding.chatbotId !== 'string' ||
          (binding.courseId !== null && typeof binding.courseId !== 'string')
      )
    )
      throw new Error('Invalid material scope')
    confirmedScope = parsed
    if (
      receipt.scopeFingerprint !== getKbMaterialScopeFingerprint(confirmedScope)
    ) {
      throw new Error('Invalid material scope fingerprint')
    }
  } catch {
    throw new GraphQLError('Material confirmation is required', {
      extensions: { code: 'KB_MATERIAL_CONFIRMATION_REQUIRED' },
    })
  }
  // Removing an audience does not authorize a new use or invalidate preparation.
  if (
    currentScope.some(
      (current) =>
        !confirmedScope.some(
          (confirmed) =>
            current.chatbotId === confirmed.chatbotId &&
            current.courseId === confirmed.courseId
        )
    )
  ) {
    throw new GraphQLError('Material access scope has changed', {
      extensions: { code: 'KB_MATERIAL_SCOPE_CHANGED' },
    })
  }
  return receipt
}
