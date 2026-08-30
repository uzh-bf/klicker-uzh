import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'
import {
  hasConfiguredModeDescriptions,
  resolveModeDescriptions,
} from '../../lib/config/modes'
import {
  getChatbotOr404,
  withChatbotTokenAuth,
} from '../../lib/server/apiGuards'

interface ChatLayoutProps {
  children: React.ReactNode
  params: Promise<{ chatbotId: string }>
}

export default async function ChatLayout({
  children,
  params,
}: ChatLayoutProps) {
  const { chatbotId } = await params

  const cookieStore = await cookies()
  const authResult = await withChatbotTokenAuth(
    cookieStore.get('participant_token')?.value,
    chatbotId
  )
  if ('response' in authResult) notFound()

  const chatbotResult = await getChatbotOr404(chatbotId, {
    id: true,
    name: true,
    avatar: true,
    systemPrompts: true,
  })
  if ('response' in chatbotResult) notFound()
  const { chatbot } = chatbotResult

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
