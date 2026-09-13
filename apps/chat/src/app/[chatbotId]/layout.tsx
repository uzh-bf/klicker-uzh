import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Assistant } from '../../components/assistant'
import {
  CHAT_SCOPED_TOKEN_HEADER,
  PWA_CHAT_EMBED_SESSION_COOKIE,
} from '../../lib/pwaEmbedAuth'
import {
  authorizeIdentityForChatbot,
  getChatbotOr404,
  resolveParticipantIdentity,
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

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const identityResult = await resolveParticipantIdentity({
    participantToken: cookieStore.get('participant_token')?.value,
    chatGuestToken: cookieStore.get('chat_participant_token')?.value,
    pwaEmbedToken: cookieStore.get(PWA_CHAT_EMBED_SESSION_COOKIE)?.value,
    // Cookie-less transports (blocked third-party cookies) arrive in the
    // reserved header the proxy sets. The value is re-verified here by
    // signature, scope and chatbot/course binding before it can authorize.
    scopedFallbackToken: headerStore.get(CHAT_SCOPED_TOKEN_HEADER) ?? undefined,
  })
  if ('response' in identityResult) notFound()

  const authorizationResult = await authorizeIdentityForChatbot(
    identityResult,
    chatbotId
  )
  if ('response' in authorizationResult) notFound()

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
