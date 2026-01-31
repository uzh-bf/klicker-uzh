import { useQuery } from '@apollo/client'
import { Chatbot, GetChatbotsInfoDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ChatbotDetails from './chatbots/ChatbotDetails'
import ChatbotList from './chatbots/ChatbotList'

function Chatbots() {
  const t = useTranslations()
  const router = useRouter()
  const { data, loading } = useQuery(GetChatbotsInfoDocument, {
    fetchPolicy: 'network-only',
  })

  const chatbots = data?.getChatbotsInfo ?? []
  const selectedId =
    typeof router.query?.chatbotId === 'string'
      ? router.query.chatbotId
      : undefined
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedId) ?? chatbots[0]

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
      <div className="mt-6 flex flex-col lg:flex-row-reverse">
        <div className="lg:w-1/2 lg:border-l lg:pl-4">
          <ChatbotDetails chatbot={selectedChatbot} loading={loading} />
        </div>
        <div className="lg:w-1/2 lg:pr-4">
          <ChatbotList
            chatbots={chatbots}
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
