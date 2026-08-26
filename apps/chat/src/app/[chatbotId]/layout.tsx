import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'
import {
  hasConfiguredModeDescriptions,
  resolveModeDescriptions,
} from '../../lib/config/modes'
import { z } from 'zod'

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
    },
  })

  // Only a PUBLISHED chatbot is reachable by participants; anything else 404s
  // exactly like a missing bot (mirrors the API guard in apiGuards.ts).
  if (!chatbot || chatbot.status !== ChatbotStatus.PUBLISHED) notFound()

  const initialModeOptions = resolveModeDescriptions(chatbot.systemPrompts)
  const initialModeOptionsAreFallback = !hasConfiguredModeDescriptions(
    chatbot.systemPrompts
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
        initialModeOptionsAreFallback={initialModeOptionsAreFallback}
      />
      {children}
    </>
  )
}
