import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Assistant } from '../../components/assistant'
import { resolveEffectiveChatModeOptions } from '../../lib/server/effectiveChatModes'

interface ChatLayoutProps {
  children: React.ReactNode
  params: Promise<{ chatbotId: string }>
}

export default async function ChatLayout({
  children,
  params,
}: ChatLayoutProps) {
  const { chatbotId } = await params

  if (!z.string().uuid().safeParse(chatbotId).success) notFound()

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      id: true,
      name: true,
      avatar: true,
      systemPrompts: true,
      status: true,
      mcpConfigurations: {
        select: {
          allowedTools: true,
          chatMode: true,
          isEnabled: true,
          parameters: true,
          priority: true,
          mcpServer: { select: { id: true } },
        },
      },
    },
  })

  // Only a PUBLISHED chatbot is reachable by participants; anything else 404s
  // exactly like a missing bot (mirrors the API guard in apiGuards.ts).
  if (!chatbot || chatbot.status !== ChatbotStatus.PUBLISHED) notFound()

  const initialModeOptions = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations
  )

  return (
    <>
      <Assistant
        chatbot={{
          id: chatbot.id,
          name: chatbot.name,
          avatar: chatbot.avatar ?? undefined,
        }}
        initialModeOptions={initialModeOptions}
      />
      {children}
    </>
  )
}
