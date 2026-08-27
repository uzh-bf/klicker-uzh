import { useQuery } from '@apollo/client'
import {
  type Chatbot,
  GetChatbotsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import ChatbotList from './chatbots/ChatbotList'

function Chatbots() {
  const t = useTranslations()
  const router = useRouter()
  const { data, loading } = useQuery(GetChatbotsInfoDocument, {
    fetchPolicy: 'network-only',
  })

  const fetchedChatbots = data?.getChatbotsInfo
  const chatbots = fetchedChatbots ?? []

  useEffect(() => {
    const legacyChatbotId = router.query.chatbotId
    if (loading || typeof legacyChatbotId !== 'string' || !fetchedChatbots) {
      return
    }

    const chatbot = fetchedChatbots.find(
      (candidate) => candidate.id === legacyChatbotId
    )
    if (!chatbot) return

    void router.replace(
      `/resources/chatbots/${encodeURIComponent(chatbot.id)}`,
      undefined,
      { shallow: true }
    )
  }, [fetchedChatbots, loading, router])

  const handleOpenChatbot = (chatbot: Chatbot) => {
    void router.push(`/resources/chatbots/${encodeURIComponent(chatbot.id)}`)
  }

  return (
    <div className="min-h-full w-full shrink-0">
      <H2>{t('manage.resources.chatbots')}</H2>
      <div className="mt-6 max-w-3xl">
        <ChatbotList
          chatbots={chatbots}
          loading={loading}
          onOpen={handleOpenChatbot}
        />
      </div>
    </div>
  )
}

export default Chatbots
