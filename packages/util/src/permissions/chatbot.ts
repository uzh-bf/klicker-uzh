/**
 * Derived permission recomputation for chatbots. The GraphQL sharing surface
 * remains unavailable until the dependent chatbot projections enforce grants.
 */
import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '../types.js'
import {
  recomputeSharedObjectPermissionsObject,
  recomputeSharedObjectPermissionsUser,
  sharedObjectDirectPermissionWhere,
  sharedObjectUserPermissionWhere,
} from './objectSharing.js'

const chatbotObjectType = DB.ObjectType.CHATBOT

export async function recomputeChatbotPermissions(
  { id, userId }: { id: string; userId?: string },
  prisma: PrismaTransactionClient
) {
  if (userId) {
    return await recomputeChatbotPermissionsUser({ id, userId }, prisma)
  }

  return await recomputeChatbotPermissionsObject({ id }, prisma)
}

export async function recomputeChatbotPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id },
    include: {
      directPermissions: {
        where: sharedObjectUserPermissionWhere(userId),
      },
    },
  })

  if (!chatbot) return

  await recomputeSharedObjectPermissionsUser(
    {
      identity: { objectType: chatbotObjectType, objectId: id },
      grants: {
        ownerId: chatbot.ownerId,
        directPermissions: chatbot.directPermissions,
      },
      userId,
    },
    prisma
  )
}

export async function recomputeChatbotPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id },
    include: {
      directPermissions: {
        where: sharedObjectDirectPermissionWhere(),
        include: {
          userGroup: {
            include: {
              members: true,
              admins: true,
            },
          },
        },
      },
    },
  })

  if (!chatbot) return

  await recomputeSharedObjectPermissionsObject(
    {
      identity: { objectType: chatbotObjectType, objectId: id },
      grants: {
        ownerId: chatbot.ownerId,
        directPermissions: chatbot.directPermissions,
      },
    },
    prisma
  )
}
