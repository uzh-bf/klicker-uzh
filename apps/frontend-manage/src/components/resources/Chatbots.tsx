import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { trpc } from '../../lib/trpc'
import ChatbotDetails from './chatbots/ChatbotDetails'
import ChatbotList from './chatbots/ChatbotList'
import type { Chatbot } from './chatbots/types'

function Chatbots() {
  const t = useTranslations()
  const router = useRouter()
  const {
    data,
    error,
    isLoading: loading,
  } = trpc.resources.chatbotsInfo.useQuery(undefined, {
    refetchOnMount: 'always',
  })
  const {
    data: modelRegistryData,
    error: modelRegistryError,
    isLoading: modelRegistryLoading,
  } = trpc.resources.chatModelRegistry.useQuery(undefined, {
    staleTime: Infinity,
  })

  const chatbots = data?.chatbotsInfo
  const modelRegistry = modelRegistryData?.chatModelRegistry
  const selectedId =
    typeof router.query?.chatbotId === 'string'
      ? router.query.chatbotId
      : undefined
  const selectedChatbot =
    chatbots?.find((chatbot) => chatbot.id === selectedId) ?? chatbots?.[0]
  const staleChatbotsError = Boolean(error && data)
  const staleModelRegistryError = Boolean(
    modelRegistryError && modelRegistryData
  )
  const detailsError = Boolean(
    (error && !data) || (modelRegistryError && !modelRegistryData)
  )

  const handleSelect = (chatbot: Chatbot) => {
    void router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, chatbotId: chatbot.id },
      },
      undefined,
      { shallow: true }
    )
  }

  return (
    <div className="h-full w-full">
      <H2>{t('manage.resources.chatbots')}</H2>
      {staleChatbotsError || staleModelRegistryError ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
          className={{ root: 'mt-4' }}
        />
      ) : null}
      <div className="mt-6 flex flex-col lg:flex-row-reverse">
        <div className="lg:w-1/2 lg:border-l lg:pl-4">
          <ChatbotDetails
            chatbot={selectedChatbot}
            modelRegistry={modelRegistry ?? []}
            error={detailsError}
            loading={loading || modelRegistryLoading}
          />
        </div>
        <div className="lg:w-1/2 lg:pr-4">
          <ChatbotList
            chatbots={chatbots}
            error={Boolean(error && !data)}
            loading={loading}
            selectedId={selectedChatbot?.id}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  )
}

export default Chatbots
