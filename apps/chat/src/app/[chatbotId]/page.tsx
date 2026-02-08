import { prisma } from '@klicker-uzh/prisma'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'

interface ChatPageProps {
  params: Promise<{ chatbotId: string }>
  searchParams?: Promise<{ embed?: string | string[] }>
}

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { chatbotId } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const embedded = parseEmbedParam(resolvedSearchParams.embed)

  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true, name: true, avatar: true },
    })

    if (!chatbot) notFound()

    return (
      <Assistant
        chatbot={{ ...chatbot, avatar: chatbot.avatar ?? undefined }}
        embedded={embedded}
      />
    )
  } catch (error) {
    // handle invalid UUID or other db errors
    console.error('Error fetching chatbot:', error)
    notFound()
  }
}
