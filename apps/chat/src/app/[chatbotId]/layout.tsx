import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Assistant } from '../../components/assistant'
import { ChatRecoveryCard } from '../../components/chat-recovery-card'
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

// Authentication and authorization failures render an explicit unavailable
// card instead of the not-found page: the chatbot exists, this session just
// cannot use it, and that difference must stay visible for diagnosis.
async function renderAccessDenied() {
  const t = await getTranslations()
  const pwaBaseUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')
    : 'https://pwa.klicker.uzh.ch'

  return (
    <ChatRecoveryCard
      dataCy="chat-access-denied"
      logoAlt={t('chat.sidebar.logoAlt')}
      title={t('chat.recovery.errorTitle')}
      message={t('chat.recovery.errorMessage')}
    >
      <Link
        data-cy="chat-access-denied-home"
        href={pwaBaseUrl}
        className="bg-primary hover:bg-primary/90 focus-visible:outline-primary/40 inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-base font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        prefetch={false}
      >
        {t('chat.recovery.openKlickerUzh')}
      </Link>
    </ChatRecoveryCard>
  )
}

export default async function ChatLayout({
  children,
  params,
}: ChatLayoutProps) {
  const { chatbotId } = await params

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const identityResult = await resolveParticipantIdentity(
    {
      participantToken: cookieStore.get('participant_token')?.value,
      chatGuestToken: cookieStore.get('chat_participant_token')?.value,
      pwaEmbedToken: cookieStore.get(PWA_CHAT_EMBED_SESSION_COOKIE)?.value,
      // Cookie-less transports (blocked third-party cookies) arrive in the
      // reserved header the proxy sets. The value is re-verified here by
      // signature, scope and chatbot/course binding before it can authorize.
      scopedFallbackToken:
        headerStore.get(CHAT_SCOPED_TOKEN_HEADER) ?? undefined,
    },
    {
      targetChatbotId: chatbotId,
    }
  )
  if ('response' in identityResult) return renderAccessDenied()

  const authorizationResult = await authorizeIdentityForChatbot(
    identityResult,
    chatbotId
  )
  if ('response' in authorizationResult) return renderAccessDenied()

  const chatbotResult = await getChatbotOr404(chatbotId, {
    id: true,
    name: true,
    avatar: true,
    systemPrompts: true,
    standardModeConfig: true,
    knowledgeGraphVisible: true,
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
        knowledgeGraphVisible={chatbot.knowledgeGraphVisible}
      />
      {children}
    </>
  )
}
