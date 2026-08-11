import { prisma } from '@klicker-uzh/prisma'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'
import { resolveModeDescriptions } from '../../lib/config/modes'
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
    select: { id: true, name: true, avatar: true, systemPrompts: true },
  })

  if (!chatbot) notFound()

  const initialModeOptions = resolveModeDescriptions(chatbot.systemPrompts)

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
