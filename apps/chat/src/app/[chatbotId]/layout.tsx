import { prisma } from '@klicker-uzh/prisma'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'

interface ChatLayoutProps {
  children: React.ReactNode
  params: Promise<{ chatbotId: string }>
}

export default async function ChatLayout({
  children,
  params,
}: ChatLayoutProps) {
  const { chatbotId } = await params

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { id: true, name: true, avatar: true },
  })

  if (!chatbot) notFound()

  return (
    <>
      <Assistant
        chatbot={{ ...chatbot, avatar: chatbot.avatar ?? undefined }}
      />
      {children}
    </>
  )
}
