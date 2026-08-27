import { getAuthenticatedManageUser } from '@/src/lib/server/manageAuth'
import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { NextResponse } from 'next/server'

const OWNER_PREVIEW_SCOPES = new Set(['ACCOUNT_OWNER', 'FULL_ACCESS'])

type PreviewUser = Awaited<ReturnType<typeof getAuthenticatedManageUser>>

type OwnerPreviewAuthDependencies = {
  getManageUser: () => Promise<PreviewUser>
  findChatbot: (chatbotId: string) => Promise<{
    ownerId: string
    status: ChatbotStatus
  } | null>
}

const defaultDependencies: OwnerPreviewAuthDependencies = {
  getManageUser: getAuthenticatedManageUser,
  findChatbot: (chatbotId) =>
    prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { ownerId: true, status: true },
    }),
}

export type OwnerPreviewAuthResult =
  | { userId: string; scope: string }
  | { response: NextResponse }

export type OwnerPreviewAccessResult =
  | { userId: string; scope: string }
  | {
      error: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'UNAVAILABLE'
    }

export async function getOwnerPreviewAccess(
  chatbotId: string,
  dependencies: OwnerPreviewAuthDependencies = defaultDependencies
): Promise<OwnerPreviewAccessResult> {
  const manageUser = await dependencies.getManageUser()
  if (!manageUser) {
    return { error: 'UNAUTHORIZED' }
  }

  if (!manageUser.scope || !OWNER_PREVIEW_SCOPES.has(manageUser.scope)) {
    return { error: 'FORBIDDEN' }
  }

  const chatbot = await dependencies.findChatbot(chatbotId)
  if (!chatbot) {
    return { error: 'NOT_FOUND' }
  }

  if (chatbot.ownerId !== manageUser.sub) {
    return { error: 'FORBIDDEN' }
  }

  if (chatbot.status === ChatbotStatus.PAUSED) {
    return { error: 'UNAVAILABLE' }
  }

  return { userId: manageUser.sub, scope: manageUser.scope }
}

export async function withOwnerPreviewAuth(
  chatbotId: string,
  dependencies: OwnerPreviewAuthDependencies = defaultDependencies
): Promise<OwnerPreviewAuthResult> {
  const access = await getOwnerPreviewAccess(chatbotId, dependencies)
  if (!('error' in access)) return access

  switch (access.error) {
    case 'UNAUTHORIZED':
      return {
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    case 'NOT_FOUND':
      return {
        response: NextResponse.json(
          { error: 'Chatbot not found' },
          { status: 404 }
        ),
      }
    case 'UNAVAILABLE':
      return {
        response: NextResponse.json(
          { error: 'Chatbot preview unavailable' },
          { status: 403 }
        ),
      }
    case 'FORBIDDEN':
      return {
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      }
  }
}
