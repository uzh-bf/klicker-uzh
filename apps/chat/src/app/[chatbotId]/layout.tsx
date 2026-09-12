import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'
import {
  getChatbotOr404,
  withChatbotTokenAuth,
} from '../../lib/server/apiGuards'
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
    standardModeConfig: true,
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
  })
  if ('response' in chatbotResult) notFound()
  const { chatbot } = chatbotResult

  const initialModeOptions = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations,
    chatbot.standardModeConfig
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
